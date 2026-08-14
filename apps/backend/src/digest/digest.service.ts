import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Ajuste } from '../ajustes/ajuste.entity';
import { EmailService } from '../auth/email.service';
import { correoDigest } from '../auth/plantillas';

const APP_URL = process.env.APP_URL ?? 'https://finanzasgz.com.mx'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** "1 ingreso" / "5 ingresos". Todos estos sustantivos pluralizan con -s. */
function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`
}

function fmtMoneda(centavos: number, moneda: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

/**
 * Resumen semanal enviado por correo.
 *
 * Se dispara desde el cron del AppModule (todos los lunes 8am) y también
 * "on demand" cuando un usuario hace login si su último digest tiene
 * más de 7 días. Best-effort: si falla, no rompe el login.
 */
@Injectable()
export class DigestService {
  private readonly log = new Logger(DigestService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Transaccion) private readonly transacciones: Repository<Transaccion>,
    @InjectRepository(Deuda) private readonly deudas: Repository<Deuda>,
    @InjectRepository(Ajuste) private readonly ajustes: Repository<Ajuste>,
    private readonly email: EmailService,
  ) {}

  /**
   * Cron semanal: lunes 8am hora del contenedor. Envía el digest a los
   * usuarios que correspondan. Si nadie lo tiene activo, es no-op.
   */
  @Cron('0 8 * * 1')
  async cronSemanal(): Promise<void> {
    const n = await this.enviarDigestAUsuarios()
    this.log.log(`digest semanal enviado a ${n} usuarios`)
  }

  /**
   * Envía el digest a todos los usuarios activos que:
   *  - tienen `recibirDigest = true`
   *  - y su último digest fue hace >6 días (o nunca)
   * Devuelve la cantidad de emails enviados.
   */
  async enviarDigestAUsuarios(): Promise<number> {
    const hace7d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    const candidatos = await this.users
      .createQueryBuilder('u')
      .where('u.recibir_digest = true')
      .andWhere('(u.ultimo_digest_en IS NULL OR u.ultimo_digest_en < :hace)', { hace: hace7d })
      .getMany()
    let enviados = 0
    for (const u of candidatos) {
      try {
        const ok = await this.enviarAUsuario(u)
        if (ok) {
          await this.users.update({ id: u.id }, { ultimoDigestEn: new Date() })
          enviados++
        }
      } catch (err) {
        this.log.warn(`digest falló para ${u.email}: ${err instanceof Error ? err.message : 'error'}`)
      }
    }
    return enviados
  }

  /**
   * Envía el digest a un usuario concreto (tras login, si toca).
   * No marca `ultimo_digest_en` para que el cron semanal no lo reenvíe
   * el mismo día.
   */
  async enviarSiToca(user: User): Promise<boolean> {
    if (!user.recibirDigest) return false
    if (user.ultimoDigestEn) {
      const dias = (Date.now() - user.ultimoDigestEn.getTime()) / (1000 * 60 * 60 * 24)
      if (dias < 6) return false
    }
    return this.enviarAUsuario(user)
  }

  private async enviarAUsuario(user: User): Promise<boolean> {
    const hoy = hoyISO()
    const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const desde = hace7.toISOString().slice(0, 10)

    const txs = await this.transacciones
      .createQueryBuilder('t')
      .where('t.user_id = :uid', { uid: user.id })
      .andWhere('t.fecha >= :desde', { desde })
      .getMany()
    const ingresos = txs.filter((t) => t.tipo === 'ingreso')
    const egresos = txs.filter((t) => t.tipo === 'egreso')
    const totIng = ingresos.reduce((acc, t) => acc + Number(t.monto), 0)
    const totEgr = egresos.reduce((acc, t) => acc + Number(t.monto), 0)
    const balance = totIng - totEgr

    const deudas = await this.deudas.find({ where: { userId: user.id, liquidada: false } })
    const deudaTotal = deudas.reduce((acc, d) => acc + Number(d.saldoActual), 0)

    const aj = await this.ajustes.findOne({ where: { userId: user.id } })
    const moneda = aj?.moneda ?? 'MXN'
    const locale = aj?.locale ?? 'es-MX'
    const fmt = (c: number) => fmtMoneda(c, moneda, locale)

    const sinMovimientos = txs.length === 0
    const mensaje = sinMovimientos
      ? 'No registraste movimientos esta semana. Un par de minutos capturando lo del súper y la gasolina es lo que hace que el semáforo sirva de algo.'
      : balance >= 0
        ? `Cerraste la semana con ${fmt(balance)} a favor. Si esto se sostiene, es el dinero que puede ir a tus metas.`
        : `Gastaste ${fmt(-balance)} más de lo que entró. Vale la pena revisar en qué se fue antes de que el mes cierre.`

    const correo = correoDigest({
      nombre: user.displayName,
      periodo: `${desde} a ${hoy}`,
      filas: [
        { etiqueta: 'Ingresos', valor: fmt(totIng), tono: 'bueno' },
        { etiqueta: 'Gastos', valor: fmt(totEgr) },
        {
          etiqueta: 'Balance',
          valor: fmt(balance),
          tono: balance >= 0 ? 'bueno' : 'alerta',
        },
        { etiqueta: 'Deuda pendiente', valor: fmt(deudaTotal) },
        {
          etiqueta: 'Movimientos',
          valor: `${plural(ingresos.length, 'ingreso')} · ${plural(egresos.length, 'gasto')}`,
        },
      ],
      mensaje,
      enlaceApp: `${APP_URL}/#/movimientos`,
    })

    await this.email.enviar({
      para: user.email,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    })
    return true
  }
}
