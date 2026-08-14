import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Ajuste } from '../ajustes/ajuste.entity';
import { EmailService } from '../auth/email.service';

const APP_URL = process.env.APP_URL ?? 'https://finanzasgz.com.mx'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
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

    const texto = [
      `Hola${user.displayName ? ` ${user.displayName}` : ''},`,
      '',
      `Tu resumen de la semana (${desde} a ${hoy}):`,
      `  · Ingresos: ${fmt(totIng)}`,
      `  · Gastos:   ${fmt(totEgr)}`,
      `  · Balance:  ${fmt(balance)}`,
      `  · Deuda:    ${fmt(deudaTotal)}`,
      '',
      `Movimientos: ${ingresos.length} ingresos y ${egresos.length} gastos.`,
      `Ver todo en la app: ${APP_URL}/#/movimientos`,
    ].join('\n')
    const html = `
      <p>Hola${user.displayName ? ` <strong>${escapeHtml(user.displayName)}</strong>` : ''},</p>
      <p>Tu resumen de la semana (<strong>${desde}</strong> a <strong>${hoy}</strong>):</p>
      <ul>
        <li>Ingresos: <strong>${escapeHtml(fmt(totIng))}</strong></li>
        <li>Gastos: <strong>${escapeHtml(fmt(totEgr))}</strong></li>
        <li>Balance: <strong style="color:${balance >= 0 ? '#10924B' : '#E2484F'}">${escapeHtml(fmt(balance))}</strong></li>
        <li>Deuda: <strong>${escapeHtml(fmt(deudaTotal))}</strong></li>
      </ul>
      <p>Movimientos: ${ingresos.length} ingresos y ${egresos.length} gastos.</p>
      <p><a href="${APP_URL}/#/movimientos">Ver todos en la app</a></p>
    `
    await this.email.enviar({
      para: user.email,
      asunto: 'Tu resumen de la semana',
      texto,
      html,
    })
    return true
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
