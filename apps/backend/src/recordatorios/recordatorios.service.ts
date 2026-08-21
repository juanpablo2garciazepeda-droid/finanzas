import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Deuda } from '../deudas/deuda.entity';
import { Ajuste } from '../ajustes/ajuste.entity';
import { EmailService } from '../auth/email.service';
import { correoVencimientos, type PagoProximo } from '../auth/plantillas';
import {
  comoTexto,
  diasEntre,
  fmtMoneda,
  hitoDe,
  hoyISO,
  siguienteOcurrencia,
} from './hitos';

const APP_URL = process.env.APP_URL ?? 'https://finanzasgz.com.mx';

/**
 * Avisos de vencimiento por correo.
 *
 * La notificación del navegador se dispara la primera vez que abres la app
 * cada día, así que quien lleva una semana sin abrirla —justo quien más
 * necesita el recordatorio— no recibe nada. Este cron corre todos los días y
 * manda un solo correo por persona con los pagos que cambiaron de hito.
 */
@Injectable()
export class RecordatoriosService {
  private readonly log = new Logger(RecordatoriosService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Deuda) private readonly deudas: Repository<Deuda>,
    @InjectRepository(Ajuste) private readonly ajustes: Repository<Ajuste>,
    private readonly email: EmailService,
  ) {}

  /** Todos los días a las 8 de la mañana, hora del contenedor. */
  @Cron('0 8 * * *')
  async cronDiario(): Promise<void> {
    const n = await this.avisarVencimientos();
    if (n > 0) this.log.log(`avisos de vencimiento enviados a ${n} usuarios`);
  }

  /** Devuelve a cuántos usuarios se les mandó correo. */
  async avisarVencimientos(hoy = hoyISO()): Promise<number> {
    const configuraciones = await this.ajustes.find({
      where: { avisosCorreoVencimientos: true },
    });
    let enviados = 0;
    for (const ajuste of configuraciones) {
      try {
        if (await this.avisarAUsuario(ajuste, hoy)) enviados++;
      } catch (err) {
        this.log.warn(
          `aviso de vencimiento falló para ${ajuste.userId}: ${
            err instanceof Error ? err.message : 'error'
          }`,
        );
      }
    }
    return enviados;
  }

  private async avisarAUsuario(ajuste: Ajuste, hoy: string): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: ajuste.userId } });
    // Sin correo verificado no se manda nada: mandarlo sería escribirle a una
    // dirección que nadie demostró controlar.
    if (!user || !user.emailVerificado) return false;

    const vivas = await this.deudas.find({
      where: { userId: ajuste.userId, liquidada: false },
    });

    const ventana = ajuste.diasAvisoVencimiento;
    const pagos: PagoProximo[] = [];
    const tocadas: Deuda[] = [];
    let total = 0;

    for (const deuda of vivas) {
      const saldo = Number(deuda.saldoActual);
      if (saldo <= 0) continue;

      const fecha = siguienteOcurrencia(deuda.fechaLimite, deuda.periodicidad, hoy);
      const dias = diasEntre(hoy, fecha);
      const hito = hitoDe(dias, ventana);
      if (!hito) continue;

      // Ya se avisó de este hito para este vencimiento. Cuando el pago sea
      // mensual y avance al mes siguiente, la fecha cambia y vuelve a contar.
      if (deuda.ultimoAvisoHito === hito && deuda.ultimoAvisoFecha === fecha) continue;

      const minimo = Number(deuda.pagoMinimo);
      const monto = Math.min(minimo > 0 ? minimo : saldo, saldo);
      total += monto;
      pagos.push({
        acreedor: deuda.acreedor,
        monto: fmtMoneda(monto, ajuste.moneda, ajuste.locale),
        cuando: comoTexto(dias),
        fecha,
        urgente: dias <= 0,
      });
      deuda.ultimoAvisoHito = hito;
      deuda.ultimoAvisoFecha = fecha;
      tocadas.push(deuda);
    }

    if (pagos.length === 0) return false;

    // Los más urgentes primero: es el orden en que hay que atenderlos.
    pagos.sort((a, b) => Number(b.urgente) - Number(a.urgente));

    const correo = correoVencimientos({
      nombre: user.displayName,
      pagos,
      total: fmtMoneda(total, ajuste.moneda, ajuste.locale),
      enlaceApp: `${APP_URL}/#/deudas`,
    });

    await this.email.enviar({
      para: user.email,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    });

    // Solo después de que el correo salió: si el envío falla, el hito sigue
    // pendiente y mañana se vuelve a intentar en vez de perderse.
    await this.deudas.save(tocadas);
    return true;
  }
}
