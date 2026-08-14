import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Servicio de email.
 *
 * Modo "console" (default mientras no haya SMTP real): imprime el email en
 * los logs del backend con un bloque bien visible. Útil para que el dev
 * copie el link de verificación/reset sin tener que configurar SMTP.
 *
 * Modo "smtp": usa nodemailer con las variables `SMTP_*`.
 *
 * Para activar SMTP, define en el .env:
 *   EMAIL_MODE=smtp
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASSWORD=...
 *   SMTP_FROM="Juanpa Finanzas <no-reply@finanzasgz.com.mx>"
 *   APP_URL=https://finanzasgz.com.mx
 */

export interface EmailMensaje {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface ServicioEmail {
  enviar(mensaje: EmailMensaje): Promise<void>;
}

@Injectable()
export class EmailService implements ServicioEmail {
  private readonly log = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly modo: 'console' | 'smtp';

  constructor() {
    this.modo = (process.env.EMAIL_MODE as 'console' | 'smtp') ?? 'console';
    if (this.modo === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD ?? '',
            }
          : undefined,
      });
    }
  }

  async enviar(mensaje: EmailMensaje): Promise<void> {
    if (this.modo === 'smtp' && this.transporter) {
      const from =
        process.env.SMTP_FROM ?? 'Juanpa Finanzas <no-reply@finanzasgz.com.mx>';
      await this.transporter.sendMail({
        from,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
      this.log.log(`Email enviado a ${mensaje.para}: ${mensaje.asunto}`);
      return;
    }
    // Modo consola: bloque bien visible para que el dev lo copie.
    const separador = '─'.repeat(60);
    this.log.warn(`\n${separador}\n📧 EMAIL → ${mensaje.para}\n${separador}\n${mensaje.texto}\n${separador}\n`);
  }
}
