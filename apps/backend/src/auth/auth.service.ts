import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from './email.service';
import { TokenVerificacion } from './token-verificacion.entity';
import { TokenResetPassword } from './token-reset-password.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * Versión con la que se emitió este token. Si la BD tiene una versión
   * mayor (porque el usuario cambió su password o cerró todas las
   * sesiones), el token queda revocado.
   */
  ver: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  emailVerificado: boolean;
  rol: 'usuario' | 'admin';
  debeCambiarPassword: boolean;
  creadoEn: string;
}

const EXPIRACION_VERIFICACION_MS = 1000 * 60 * 60 * 24; // 24h
const EXPIRACION_RESET_MS = 1000 * 60 * 30; // 30 min
const APP_URL = process.env.APP_URL ?? 'https://finanzasgz.com.mx';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    @InjectRepository(TokenVerificacion)
    private readonly tokensVerificacion: Repository<TokenVerificacion>,
    @InjectRepository(TokenResetPassword)
    private readonly tokensReset: Repository<TokenResetPassword>,
  ) {}

  // ── Registro ─────────────────────────────────────────────────────────────

  async register(
    email: string,
    password: string,
    displayName: string,
    request?: Request,
  ): Promise<{ user: PublicUser; mensaje: string }> {
    const lowerEmail = email.toLowerCase();

    if (!this.passwordCumplePolitica(password)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
    }

    const existing = await this.users.findByEmail(lowerEmail);
    if (existing) {
      // Mensaje genérico: no decimos "ya existe" para no confirmar correos
      // ajenos. Pero para evitar doble envío al mismo dev, no creamos nada.
      throw new ConflictException(
        'Si el correo no estaba registrado, te enviamos un email de verificación.',
      );
    }

    const user = await this.users.create(lowerEmail, password, displayName);
    const token = await this.crearTokenVerificacion(user.id);
    await this.enviarEmailVerificacion(user, token);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'registro',
      ip: this.ip(request),
      userAgent: this.ua(request),
    });

    return {
      user: this.toPublic(user),
      mensaje: 'Te enviamos un correo para verificar tu cuenta.',
    };
  }

  // ── Verificación de email ────────────────────────────────────────────────

  async reenviarVerificacion(
    email: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    const user = await this.users.findByEmail(email);
    // Mensaje siempre genérico para no confirmar si el email existe.
    const mensaje = 'Si el correo está registrado y pendiente, te enviamos un email de verificación.';

    if (!user) {
      void this.auditoria.registrar({
        emailIntento: email.toLowerCase(),
        accion: 'reenvio_verificacion',
        detalles: { motivo: 'email_no_encontrado' },
        ip: this.ip(request),
      });
      return { mensaje };
    }

    if (user.emailVerificado) {
      void this.auditoria.registrar({
        usuarioId: user.id,
        emailIntento: user.email,
        accion: 'reenvio_verificacion',
        detalles: { motivo: 'ya_verificado' },
      });
      return { mensaje };
    }

    const token = await this.crearTokenVerificacion(user.id);
    await this.enviarEmailVerificacion(user, token);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'reenvio_verificacion',
      ip: this.ip(request),
    });

    return { mensaje };
  }

  async verificarEmail(token: string, request?: Request): Promise<{ user: PublicUser }> {
    const hash = this.hashToken(token);
    const fila = await this.tokensVerificacion.findOne({ where: { tokenHash: hash } });

    if (!fila || fila.usadoEn || fila.expiraEn < new Date()) {
      throw new BadRequestException('El enlace de verificación no es válido o ya expiró.');
    }

    await this.tokensVerificacion.update(
      { id: fila.id },
      { usadoEn: new Date() },
    );
    await this.users.marcarEmailVerificado(fila.usuarioId);
    const user = await this.users.findByIdOrThrow(fila.usuarioId);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'verificacion_email',
      ip: this.ip(request),
    });

    return { user: this.toPublic(user) };
  }

  private async crearTokenVerificacion(usuarioId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const hash = this.hashToken(raw);
    await this.tokensVerificacion.insert({
      usuarioId,
      tokenHash: hash,
      expiraEn: new Date(Date.now() + EXPIRACION_VERIFICACION_MS),
    });
    return raw;
  }

  private async enviarEmailVerificacion(user: User, token: string): Promise<void> {
    const link = `${APP_URL}/#/verificar-email?token=${encodeURIComponent(token)}`;
    const texto = [
      `Hola${user.displayName ? ` ${user.displayName}` : ''},`,
      '',
      'Para terminar de crear tu cuenta en Juanpa Finanzas, confirma tu correo:',
      link,
      '',
      'El enlace expira en 24 horas. Si no fuiste tú, ignora este mensaje.',
    ].join('\n');
    const html = `
      <p>Hola${user.displayName ? ` <strong>${escapeHtml(user.displayName)}</strong>` : ''},</p>
      <p>Para terminar de crear tu cuenta en <strong>Juanpa Finanzas</strong>, confirma tu correo:</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#666;font-size:13px">El enlace expira en 24 horas. Si no fuiste tú, ignora este mensaje.</p>
    `;
    await this.email.enviar({ para: user.email, asunto: 'Verifica tu correo', texto, html });
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    request?: Request,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const lowerEmail = email.toLowerCase();
    const user = await this.users.findByEmail(lowerEmail);

    // Misma respuesta para "no existe" y "password mal": no filtramos.
    const credencialesInvalidas = new UnauthorizedException(
      'El correo o la contraseña no son correctos.',
    );

    if (!user) {
      void this.auditoria.registrar({
        emailIntento: lowerEmail,
        accion: 'login_fallo',
        detalles: { motivo: 'email_no_encontrado' },
        ip: this.ip(request),
        userAgent: this.ua(request),
      });
      throw credencialesInvalidas;
    }

    const ok = await this.users.verifyPassword(password, user.passwordHash);
    if (!ok) {
      void this.auditoria.registrar({
        usuarioId: user.id,
        emailIntento: user.email,
        accion: 'login_fallo',
        detalles: { motivo: 'password_incorrecta' },
        ip: this.ip(request),
        userAgent: this.ua(request),
      });
      throw credencialesInvalidas;
    }

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'login_ok',
      ip: this.ip(request),
      userAgent: this.ua(request),
    });

    return this.issue(user);
  }

  // ── Olvidé / restablecer password ───────────────────────────────────────

  async olvidePassword(
    email: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    const lowerEmail = email.toLowerCase();
    const user = await this.users.findByEmail(lowerEmail);
    // Mensaje siempre genérico.
    const mensaje = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

    if (!user) {
      void this.auditoria.registrar({
        emailIntento: lowerEmail,
        accion: 'olvide_password',
        detalles: { motivo: 'email_no_encontrado' },
        ip: this.ip(request),
      });
      return { mensaje };
    }

    const token = await this.crearTokenReset(user.id);
    await this.enviarEmailReset(user, token);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'olvide_password',
      ip: this.ip(request),
    });

    return { mensaje };
  }

  async restablecerPassword(
    token: string,
    nuevoPassword: string,
    request?: Request,
  ): Promise<{ user: PublicUser }> {
    if (!this.passwordCumplePolitica(nuevoPassword)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
    }
    const hash = this.hashToken(token);
    const fila = await this.tokensReset.findOne({ where: { tokenHash: hash } });
    if (!fila || fila.usadoEn || fila.expiraEn < new Date()) {
      throw new BadRequestException('El enlace de restablecimiento no es válido o ya expiró.');
    }
    await this.tokensReset.update({ id: fila.id }, { usadoEn: new Date() });
    const passwordHash = await (await import('bcrypt')).hash(nuevoPassword, 12);
    await this.users.actualizarPassword(fila.usuarioId, passwordHash);
    // Invalida cualquier sesión abierta.
    await this.users.incrementarTokenVersion(fila.usuarioId);
    const user = await this.users.findByIdOrThrow(fila.usuarioId);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'reset_password',
      ip: this.ip(request),
    });

    return { user: this.toPublic(user) };
  }

  private async crearTokenReset(usuarioId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const hash = this.hashToken(raw);
    await this.tokensReset.insert({
      usuarioId,
      tokenHash: hash,
      expiraEn: new Date(Date.now() + EXPIRACION_RESET_MS),
    });
    return raw;
  }

  private async enviarEmailReset(user: User, token: string): Promise<void> {
    const link = `${APP_URL}/#/restablecer-password?token=${encodeURIComponent(token)}`;
    const texto = [
      `Hola${user.displayName ? ` ${user.displayName}` : ''},`,
      '',
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
      'Si fuiste tú, entra a este enlace (expira en 30 minutos):',
      link,
      '',
      'Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.',
    ].join('\n');
    const html = `
      <p>Hola${user.displayName ? ` <strong>${escapeHtml(user.displayName)}</strong>` : ''},</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
      <p>Si fuiste tú, entra a este enlace (expira en 30 minutos):</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#666;font-size:13px">Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.</p>
    `;
    await this.email.enviar({ para: user.email, asunto: 'Restablece tu contraseña', texto, html });
  }

  // ── Perfil, password, sesión ────────────────────────────────────────────

  async cambiarPassword(
    userId: string,
    actual: string,
    nuevo: string,
    request?: Request,
  ): Promise<{ user: PublicUser }> {
    if (!this.passwordCumplePolitica(nuevo)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
    }
    const user = await this.users.findByIdOrThrow(userId);
    const ok = await this.users.verifyPassword(actual, user.passwordHash);
    if (!ok) {
      void this.auditoria.registrar({
        usuarioId: user.id,
        emailIntento: user.email,
        accion: 'cambio_password',
        detalles: { motivo: 'password_actual_incorrecta' },
        ip: this.ip(request),
      });
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(nuevo, 12);
    await this.users.actualizarPassword(userId, passwordHash);
    // Invalida las demás sesiones.
    await this.users.incrementarTokenVersion(userId);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'cambio_password',
      detalles: { ok: true },
      ip: this.ip(request),
    });

    return { user: this.toPublic(user) };
  }

  async actualizarPerfil(
    userId: string,
    cambios: { displayName?: string },
    request?: Request,
  ): Promise<{ user: PublicUser }> {
    const user = await this.users.actualizarPerfil(userId, cambios);
    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'actualizacion_perfil',
      detalles: { campos: Object.keys(cambios) },
      ip: this.ip(request),
    });
    return { user: this.toPublic(user) };
  }

  async logoutAll(
    userId: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    await this.users.incrementarTokenVersion(userId);
    void this.auditoria.registrar({
      usuarioId: userId,
      accion: 'logout_all',
      ip: this.ip(request),
    });
    return { mensaje: 'Cerramos la sesión en todos tus dispositivos.' };
  }

  async eliminarCuenta(
    userId: string,
    password: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    const user = await this.users.findByIdOrThrow(userId);
    const ok = await this.users.verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('La contraseña no es correcta.');
    }
    await this.users.eliminar(userId);
    void this.auditoria.registrar({
      // No tiene usuarioId ya: el cascade borró al user, pero dejamos el email
      // en emailIntento para que quede registro de qué se eliminó.
      usuarioId: null,
      emailIntento: user.email,
      accion: 'eliminacion_cuenta',
      ip: this.ip(request),
    });
    return { mensaje: 'Tu cuenta y todos tus datos fueron eliminados.' };
  }

  // ── JWT ─────────────────────────────────────────────────────────────────

  /**
   * Valida que el payload del JWT siga vigente comparando `ver` con la BD.
   * Devuelve el User actualizado o lanza 401.
   */
  async validarPayload(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    if (user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Tu sesión fue cerrada en otro dispositivo.');
    }
    return user;
  }

  private issue(user: User): { accessToken: string; user: PublicUser } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      ver: user.tokenVersion,
    };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: this.toPublic(user),
    };
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerificado: user.emailVerificado,
      rol: user.rol,
      debeCambiarPassword: user.debeCambiarPassword,
      creadoEn: user.createdAt.toISOString(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private passwordCumplePolitica(p: string): boolean {
    if (p.length < 8) return false;
    if (p.length > 128) return false;
    if (!/[a-z]/.test(p)) return false;
    if (!/[A-Z]/.test(p)) return false;
    if (!/[0-9]/.test(p)) return false;
    return true;
  }

  private ip(request?: Request): string | null {
    if (!request) return null;
    const fwd = request.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    return request.ip ?? null;
  }

  private ua(request?: Request): string | null {
    if (!request) return null;
    const ua = request.headers['user-agent'];
    if (typeof ua === 'string') return ua.slice(0, 500);
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
