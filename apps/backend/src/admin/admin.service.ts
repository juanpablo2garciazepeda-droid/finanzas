import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Transaccion } from '../transacciones/transaccion.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Meta } from '../metas/meta.entity';
import { Categoria } from '../categorias/categoria.entity';
import { TokenResetPassword } from '../auth/token-reset-password.entity';
import { EmailService } from '../auth/email.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { correoReset } from '../auth/plantillas';

/** Cuántas horas vive un enlace de reset forzado. Igual al flujo normal. */
const EXPIRACION_RESET_MS = 60 * 60 * 1000

/**
 * Lógica del panel de administración.
 *
 * Permite a usuarios con `rol: 'admin'`:
 *  - Listar todos los usuarios con su metadata (sin contraseñas).
 *  - Ver el detalle de un usuario y conteos de sus datos.
 *  - Borrar un usuario (cascada: categorías, transacciones, deudas, metas).
 *  - Forzar un reset de contraseña: marca `debeCambiarPassword`, invalida
 *    todas las sesiones del usuario, y le envía un correo con un enlace
 *    para que elija una nueva contraseña.
 *
 * NO permite ver la contraseña actual (es un hash bcrypt; ni el admin
 * debería poder verla).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersService,
    private readonly email: EmailService,
    private readonly auditoria: AuditoriaService,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Transaccion)
    private readonly transacciones: Repository<Transaccion>,
    @InjectRepository(Deuda)
    private readonly deudas: Repository<Deuda>,
    @InjectRepository(Meta)
    private readonly metas: Repository<Meta>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(TokenResetPassword)
    private readonly tokensReset: Repository<TokenResetPassword>,
  ) {}

  /**
   * Lista todos los usuarios con su metadata.
   * NO incluye `passwordHash` ni nada que no deba salir de la BD.
   */
  async listarUsuarios(): Promise<Array<{
    id: string
    email: string
    displayName: string
    fotoUrl: string | null
    emailVerificado: boolean
    rol: 'usuario' | 'admin'
    idioma: string
    creadoEn: string
    updatedAt: string
  }>> {
    const usuarios = await this.usersRepo.find({
      order: { createdAt: 'DESC' },
    })
    return usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      fotoUrl: u.fotoUrl,
      emailVerificado: u.emailVerificado,
      rol: u.rol,
      idioma: u.idioma,
      creadoEn: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))
  }

  /**
   * Detalle de un usuario + conteos de sus datos.
   * `debeCambiarPassword` y `passwordActualizadoEn` se exponen para que el
   * admin sepa si debe intervenir.
   */
  async detalleUsuario(id: string): Promise<{
    usuario: {
      id: string
      email: string
      displayName: string
      fotoUrl: string | null
      emailVerificado: boolean
      emailVerificadoEn: string | null
      rol: 'usuario' | 'admin'
      idioma: string
      recibirDigest: boolean
      debeCambiarPassword: boolean
      passwordActualizadoEn: string | null
      tokenVersion: number
      creadoEn: string
      updatedAt: string
    }
    conteos: {
      transacciones: number
      categorias: number
      presupuestos: number
      deudas: number
      metas: number
      recurrentes: number
    }
  }> {
    const u = await this.users.findByIdOrThrow(id)
    const [transacciones, categorias, deudas, metas] = await Promise.all([
      this.transacciones.count({ where: { userId: id } }),
      this.categorias.count({ where: { userId: id } }),
      this.deudas.count({ where: { userId: id } }),
      this.metas.count({ where: { userId: id } }),
    ])
    return {
      usuario: {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        fotoUrl: u.fotoUrl,
        emailVerificado: u.emailVerificado,
        emailVerificadoEn: u.emailVerificadoEn
          ? u.emailVerificadoEn.toISOString()
          : null,
        rol: u.rol,
        idioma: u.idioma,
        recibirDigest: u.recibirDigest,
        debeCambiarPassword: u.debeCambiarPassword,
        passwordActualizadoEn: u.passwordActualizadoEn
          ? u.passwordActualizadoEn.toISOString()
          : null,
        tokenVersion: u.tokenVersion,
        creadoEn: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      },
      conteos: {
        transacciones,
        categorias,
        // presupuestos/recurrentes: si no hay repos accesibles desde acá
        // los dejamos en 0. No es crítico para el MVP.
        presupuestos: 0,
        deudas,
        metas,
        recurrentes: 0,
      },
    }
  }

  /**
   * Borra un usuario. La BD tiene `ON DELETE CASCADE` en las FKs, así que
   * un `delete` se lleva categorías, transacciones, deudas, metas, etc.
   * El admin no puede borrarse a sí mismo.
   */
  async eliminarUsuario(id: string, adminId: string, request?: Request): Promise<void> {
    if (id === adminId) {
      throw new BadRequestException('No puedes borrarte a ti mismo.')
    }
    const u = await this.users.findByIdOrThrow(id)
    await this.users.eliminar(id)
    void this.auditoria.registrar({
      usuarioId: adminId,
      emailIntento: u.email,
      accion: 'admin_eliminar_usuario',
      detalles: { usuarioEliminadoId: id, email: u.email },
      ip: this.ip(request),
    })
  }

  /**
   * Borrado en lote: hace todo en una sola transacción para que o se borran
   * todos los elegibles o no se borra ninguno. Devuelve la lista de
   * eliminados y la de omitidos con su razón, así el front puede mostrar
   * feedback por id sin asumir nada del estado del servidor.
   *
   * Reglas de seguridad:
   *  - El admin que ejecuta la acción no puede estar en la lista.
   *  - No se puede dejar el sistema sin admins: si tras el borrado no queda
   *    ninguno, se cancela el lote entero.
   *  - Ids inexistentes o duplicados se reportan como omitidos, no fallan.
   */
  async eliminarUsuariosLote(
    ids: string[],
    adminId: string,
    request?: Request,
  ): Promise<{
    eliminados: string[]
    omitidos: Array<{ id: string; razon: string }>
  }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('La lista de ids está vacía.')
    }
    // Dedupe preservando orden.
    const unicos = Array.from(new Set(ids))

    // Trae los usuarios que sí existen; los ids faltantes se reportan abajo.
    const encontrados = await this.usersRepo.find({
      where: unicos.map((id) => ({ id })),
    })
    const porId = new Map(encontrados.map((u) => [u.id, u]))
    const omitidos: Array<{ id: string; razon: string }> = []

    for (const id of unicos) {
      if (!porId.has(id)) {
        omitidos.push({ id, razon: 'No existe.' })
      } else if (id === adminId) {
        omitidos.push({ id, razon: 'No puedes borrarte a ti mismo.' })
      }
    }
    const elegibles = unicos.filter((id) => porId.has(id) && id !== adminId)

    // Regla "no dejar el sistema sin admins": si entre los elegibles hay
    // admins y la cuenta actual de admins menos los admins a borrar es 0,
    // se aborta el lote.
    const adminsAEliminar = elegibles.filter((id) => porId.get(id)!.rol === 'admin')
    const totalAdmins = await this.usersRepo.count({ where: { rol: 'admin' } })
    if (adminsAEliminar.length > 0 && totalAdmins - adminsAEliminar.length < 1) {
      throw new BadRequestException(
        'No puedes borrar a los últimos administradores del sistema.',
      )
    }

    if (elegibles.length === 0) {
      return { eliminados: [], omitidos }
    }

    // Una sola transacción: o se borran todos o ninguno.
    const emailsEliminados: Array<{ id: string; email: string }> = []
    await this.dataSource.transaction(async (manager) => {
      for (const id of elegibles) {
        const u = porId.get(id)!
        // ON DELETE CASCADE se lleva categorías, transacciones, deudas, metas.
        await manager.delete(User, { id })
        emailsEliminados.push({ id, email: u.email })
      }
    })

    // Auditoría: una entrada por borrado, con el lote como contexto.
    for (const { id, email } of emailsEliminados) {
      void this.auditoria.registrar({
        usuarioId: adminId,
        emailIntento: email,
        accion: 'admin_eliminar_usuario',
        detalles: { usuarioEliminadoId: id, email, lote: true, totalLote: elegibles.length },
        ip: this.ip(request),
      })
    }

    return {
      eliminados: elegibles,
      omitidos,
    }
  }

  /**
   * Fuerza un reset de contraseña para un usuario:
   *  1. Marca `debeCambiarPassword = true` (al usuario le aparecerá la
   *     pantalla de cambio la próxima vez que entre).
   *  2. Invalida todas las sesiones (sube `tokenVersion`).
   *  3. Crea un token de reset y le envía un correo con el enlace.
   */
  async forzarResetPassword(
    id: string,
    adminId: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    const u = await this.users.findByIdOrThrow(id)
    if (u.id === adminId) {
      throw new BadRequestException('No puedes forzar un reset sobre ti mismo.')
    }
    // 1) Marca el flag
    await this.usersRepo.update({ id: u.id }, { debeCambiarPassword: true })
    // 2) Invalida sesiones
    await this.users.incrementarTokenVersion(u.id)
    // 3) Crea token + envía correo
    const token = await this.crearTokenReset(u.id)
    await this.enviarEmailReset(u, token)
    void this.auditoria.registrar({
      usuarioId: adminId,
      emailIntento: u.email,
      accion: 'admin_forzar_reset',
      detalles: { usuarioAfectadoId: u.id, email: u.email },
      ip: this.ip(request),
    })
    return { mensaje: `Le enviamos un enlace de restablecimiento a ${u.email}.` }
  }

  private async crearTokenReset(usuarioId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url')
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    await this.tokensReset.insert({
      usuarioId,
      tokenHash: hash,
      expiraEn: new Date(Date.now() + EXPIRACION_RESET_MS),
    })
    return raw
  }

  private async enviarEmailReset(user: User, token: string): Promise<void> {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const link = `${appUrl}/#/restablecer-password?token=${encodeURIComponent(token)}`
    const correo = correoReset(user.displayName || user.email, link)
    await this.email.enviar({
      para: user.email,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    })
  }

  private ip(request?: Request): string | null {
    if (!request) return null
    const fwd = request.headers['x-forwarded-for']
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
    return request.ip ?? null
  }

  // El método público para que el admin pueda asignar admin a otros sin
  // tocar la BD manualmente.
  async asignarRol(id: string, rol: 'usuario' | 'admin'): Promise<void> {
    const u = await this.users.findByIdOrThrow(id)
    await this.usersRepo.update({ id: u.id }, { rol })
  }
}
