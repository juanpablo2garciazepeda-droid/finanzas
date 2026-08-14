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
import { RecurrentesService } from '../recurrentes/recurrentes.service';
import { DigestService } from '../digest/digest.service';
import { TokenVerificacion } from './token-verificacion.entity';
import { TokenResetPassword } from './token-reset-password.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';
import {
  correoBienvenida,
  correoCambioCorreo,
  correoReset,
  correoVerificacion,
} from './plantillas';

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
  fotoUrl: string | null;
  emailVerificado: boolean;
  rol: 'usuario' | 'admin';
  debeCambiarPassword: boolean;
  idioma: 'es' | 'en';
  recibirDigest: boolean;
  creadoEn: string;
}

/**
 * 30 minutos, igual para el enlace y para el código de 6 dígitos que van en el
 * mismo correo: son dos formas de canjear la misma fila, y dos vencimientos
 * distintos solo servirían para que la pantalla tuviera que explicar cuál de
 * los dos caducó. Quien tarde más tiene el botón de reenviar a un clic.
 */
const EXPIRACION_VERIFICACION_MS = 1000 * 60 * 30;
const EXPIRACION_RESET_MS = 1000 * 60 * 30;
/** Intentos fallidos antes de quemar un código. 6 dígitos son un millón de
 *  combinaciones; sin tope, un bot las recorre. */
const MAX_INTENTOS_CODIGO = 6;
const APP_URL = process.env.APP_URL ?? 'https://finanzasgz.com.mx';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly recurrentes: RecurrentesService,
    private readonly digest: DigestService,
    @InjectRepository(TokenVerificacion)
    private readonly tokensVerificacion: Repository<TokenVerificacion>,
    @InjectRepository(TokenResetPassword)
    private readonly tokensReset: Repository<TokenResetPassword>,
  ) {}

  // ── Registro ─────────────────────────────────────────────────────────────

  /**
   * Resultado del registro. La UI distingue tres casos:
   *   - `cuentaCreada: true` → "te enviamos correo" + opción de reenviar
   *   - `cuentaCreada: false` → "ya está registrado, ¿quieres login o reset?"
   *   - throw BadRequest → contraseña no cumple política
   *   - throw Throttler → demasiados intentos
   *
   * El status HTTP también diferencia: 201 cuando se crea, 200 cuando ya
   * existía. El mensaje genérico estilo "si el correo no estaba registrado..."
   * era confuso para usuarios reales: pensaban que les iba a llegar y no
   * llegaba, y no sabían si tenían que esperar o si algo estaba mal.
   */
  async register(
    email: string,
    password: string,
    displayName: string,
    fotoUrl?: string,
    request?: Request,
  ): Promise<{
    cuentaCreada: true;
    user: PublicUser;
    mensaje: string;
    emailEnviadoA: string;
    emailOk: boolean;
  }> {
    const lowerEmail = email.toLowerCase();

    if (!this.passwordCumplePolitica(password)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
    }

    const existing = await this.users.findByEmail(lowerEmail);
    if (existing) {
      // Email ya registrado: NO creamos usuario ni mandamos correo. Lanzamos
      // 409 con un mensaje claro para que la UI pueda mostrar "ya tienes
      // cuenta" + link a login/reset.
      throw new ConflictException(
        'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.',
      );
    }

    const user = await this.users.create(lowerEmail, password, displayName, fotoUrl);
    const { token, codigo } = await this.crearTokenVerificacion(user.id);
    let emailOk = true;
    try {
      await this.enviarEmailVerificacion(user, token, codigo);
    } catch {
      // El usuario ya quedó creado; si el email falla, lo importante es no
      // mentirle. Devolvemos emailOk=false para que la UI lo sepa.
      emailOk = false;
    }

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'registro',
      ip: this.ip(request),
      userAgent: this.ua(request),
    });

    return {
      cuentaCreada: true,
      user: this.toPublic(user),
      mensaje: emailOk
        ? `Te enviamos un código a ${user.email}.`
        : `Cuenta creada, pero no pudimos enviar el correo a ${user.email}. Usa "Reenviar" en la siguiente pantalla.`,
      emailEnviadoA: user.email,
      emailOk,
    };
  }

  /**
   * Canje del código de 6 dígitos.
   *
   * A diferencia de `verificarEmail` (que recibe un token largo del enlace y
   * no necesita saber de quién es), aquí hace falta el email: el código por sí
   * solo no identifica a nadie, y buscar "el usuario que tenga este código"
   * permitiría acertarle a la cuenta de cualquiera.
   *
   * Devuelve sesión iniciada. Quien acaba de demostrar que controla el correo
   * no tiene por qué volver a teclear la contraseña que escribió hace un
   * minuto: es el mismo flujo que ya conoce de Google.
   */
  async verificarCodigo(
    email: string,
    codigo: string,
    request?: Request,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const invalido = new BadRequestException(
      'El código no es correcto o ya expiró. Pide uno nuevo.',
    );

    const user = await this.users.findByEmail(email);
    if (!user) throw invalido;

    // El más reciente sin usar. Pedir otro código invalida el anterior de
    // hecho (el usuario teclea el que le acaba de llegar), y así no hay que
    // barrer filas viejas en cada intento.
    const fila = await this.tokensVerificacion.findOne({
      where: { usuarioId: user.id, usadoEn: IsNull() },
      order: { creadoEn: 'DESC' },
    });

    if (!fila || !fila.codigoHash || fila.expiraEn < new Date()) {
      throw invalido;
    }

    if (fila.intentos >= MAX_INTENTOS_CODIGO) {
      void this.auditoria.registrar({
        usuarioId: user.id,
        emailIntento: user.email,
        accion: 'verificacion_email',
        detalles: { motivo: 'codigo_agotado' },
        ip: this.ip(request),
      });
      throw new BadRequestException(
        'Ese código se bloqueó por demasiados intentos. Pide uno nuevo.',
      );
    }

    // Comparación en tiempo constante: comparar hashes con === filtra
    // información por el tiempo que tarda en fallar.
    const hashRecibido = this.hashToken(codigo);
    const coincide = crypto.timingSafeEqual(
      Buffer.from(hashRecibido, 'hex'),
      Buffer.from(fila.codigoHash, 'hex'),
    );

    if (!coincide) {
      await this.tokensVerificacion.increment({ id: fila.id }, 'intentos', 1);
      void this.auditoria.registrar({
        usuarioId: user.id,
        emailIntento: user.email,
        accion: 'verificacion_email',
        detalles: { motivo: 'codigo_incorrecto', intento: fila.intentos + 1 },
        ip: this.ip(request),
      });
      throw invalido;
    }

    await this.tokensVerificacion.update({ id: fila.id }, { usadoEn: new Date() });
    await this.users.marcarEmailVerificado(user.id);
    const actualizado = await this.users.findByIdOrThrow(user.id);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'verificacion_email',
      detalles: { via: 'codigo' },
      ip: this.ip(request),
      userAgent: this.ua(request),
    });

    // Best-effort: la bienvenida no puede tumbar el alta.
    void this.enviarBienvenida(actualizado);

    return this.issue(actualizado);
  }

  private async enviarBienvenida(user: User): Promise<void> {
    try {
      const correo = correoBienvenida(user.displayName, `${APP_URL}/#/`);
      await this.email.enviar({
        para: user.email,
        asunto: correo.asunto,
        texto: correo.texto,
        html: correo.html,
      });
    } catch {
      // best-effort
    }
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

    const { token, codigo } = await this.crearTokenVerificacion(user.id);
    await this.enviarEmailVerificacion(user, token, codigo);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: user.email,
      accion: 'reenvio_verificacion',
      ip: this.ip(request),
    });

    return { mensaje };
  }

  /**
   * Solicita cambio de correo: marca `email_pendiente` y envía un link de
   * verificación al NUEVO correo. Si el usuario pica el link, el backend
   * hace el swap y le marca como verificado.
   */
  async solicitarCambioCorreo(
    userId: string,
    nuevoEmail: string,
    request?: Request,
  ): Promise<{ mensaje: string }> {
    const lower = nuevoEmail.toLowerCase()
    const actual = await this.users.findById(userId)
    if (!actual) throw new BadRequestException('Usuario no encontrado.')
    if (lower === actual.email) {
      throw new BadRequestException('Ese ya es tu correo actual.')
    }
    const existente = await this.users.findByEmail(lower)
    if (existente) {
      // Mensaje genérico: no confirmamos que el correo ya está en uso.
      throw new BadRequestException(
        'Si el correo está libre y es válido, te enviamos un enlace de verificación.',
      )
    }
    const { token } = await this.crearTokenVerificacion(userId)
    await this.enviarEmailCambioCorreo(actual, lower, token)
    void this.auditoria.registrar({
      usuarioId: userId,
      emailIntento: lower,
      accion: 'verificacion_email',
      detalles: { motivo: 'cambio_correo', anterior: actual.email },
      ip: this.ip(request),
    })
    return {
      mensaje:
        'Te enviamos un enlace al nuevo correo. Pícalo para confirmar el cambio.',
    }
  }

  private async enviarEmailCambioCorreo(
    user: User,
    nuevoEmail: string,
    token: string,
  ): Promise<void> {
    // El `nuevoEmail` viaja en la URL porque el canje lo aplica el backend al
    // recibirlo de vuelta: la fila del token solo sabe de qué usuario es, no a
    // qué correo se quería mudar.
    const link =
      `${APP_URL}/#/verificar-email?token=${encodeURIComponent(token)}` +
      `&cambio=1&correo=${encodeURIComponent(nuevoEmail)}`
    const correo = correoCambioCorreo(user.displayName, nuevoEmail, link)
    await this.email.enviar({
      para: nuevoEmail,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    })
  }

  /**
   * Si el token de verificación trae `?cambio=1` y el usuario tiene
   * un `email_pendiente` distinto, hace el swap.
   */
  async aplicarCambioCorreoSiProcede(
    userId: string,
    nuevoEmail: string,
  ): Promise<void> {
    const user = await this.users.findById(userId)
    if (!user) return
    if (nuevoEmail === user.email) return
    // Verificamos que nadie más lo haya tomado en el interín.
    const conflicto = await this.users.findByEmail(nuevoEmail)
    if (conflicto) return
    await this.users.actualizarCorreo(userId, nuevoEmail)
    void this.auditoria.registrar({
      usuarioId: userId,
      emailIntento: nuevoEmail,
      accion: 'actualizacion_perfil',
      detalles: { campos: ['email'], anterior: user.email },
    })
  }

  async verificarEmail(
    token: string,
    options: { nuevoEmail?: string; request?: Request } = {},
  ): Promise<{ user: PublicUser; cambioAplicado: boolean }> {
    const hash = this.hashToken(token);
    const fila = await this.tokensVerificacion.findOne({ where: { tokenHash: hash } });

    if (!fila || fila.usadoEn || fila.expiraEn < new Date()) {
      throw new BadRequestException('El enlace de verificación no es válido o ya expiró.');
    }

    await this.tokensVerificacion.update(
      { id: fila.id },
      { usadoEn: new Date() },
    );

    // Si la verificación trae un nuevo email pendiente, hacemos el swap.
    let cambioAplicado = false;
    if (options.nuevoEmail) {
      const lower = options.nuevoEmail.toLowerCase();
      const actual = await this.users.findById(fila.usuarioId);
      if (actual && lower !== actual.email) {
        const conflicto = await this.users.findByEmail(lower);
        if (!conflicto) {
          await this.users.actualizarCorreo(fila.usuarioId, lower);
          cambioAplicado = true;
        }
      }
    }
    await this.users.marcarEmailVerificado(fila.usuarioId);
    const user = await this.users.findByIdOrThrow(fila.usuarioId);

    void this.auditoria.registrar({
      usuarioId: user.id,
      emailIntento: options.nuevoEmail ?? user.email,
      accion: 'verificacion_email',
      detalles: cambioAplicado ? { motivo: 'cambio_correo' } : undefined,
      ip: this.ip(options.request),
    });

    return { user: this.toPublic(user), cambioAplicado };
  }

  /**
   * Una fila sirve para las dos vías: el token largo del enlace y el código de
   * 6 dígitos que se teclea. Van juntos porque son el mismo permiso concedido
   * una sola vez; usar el uno consume al otro.
   */
  private async crearTokenVerificacion(
    usuarioId: string,
  ): Promise<{ token: string; codigo: string }> {
    const raw = crypto.randomBytes(32).toString('base64url');
    // randomInt y no Math.random: el segundo es predecible a partir de unas
    // pocas salidas, y esto autoriza el alta de una cuenta.
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await this.tokensVerificacion.insert({
      usuarioId,
      tokenHash: this.hashToken(raw),
      codigoHash: this.hashToken(codigo),
      intentos: 0,
      expiraEn: new Date(Date.now() + EXPIRACION_VERIFICACION_MS),
    });
    return { token: raw, codigo };
  }

  private async enviarEmailVerificacion(
    user: User,
    token: string,
    codigo: string,
  ): Promise<void> {
    const link = `${APP_URL}/#/verificar-email?token=${encodeURIComponent(token)}`;
    const correo = correoVerificacion(user.displayName, codigo, link);
    await this.email.enviar({
      para: user.email,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    });
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

    // Hooks post-login (best-effort, no rompen el flujo):
    //  - procesar recurrentes que tocan este mes
    //  - enviar digest semanal si toca
    void this.ejecutarHooksPostLogin(user.id)

    return this.issue(user);
  }

  private async ejecutarHooksPostLogin(userId: string): Promise<void> {
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      const r = await this.recurrentes.ejecutarPendientes(userId, hoy)
      if (r.generadas > 0) {
        void this.auditoria.registrar({
          usuarioId: userId,
          accion: 'actualizacion_perfil',
          detalles: { motivo: 'recurrentes_generados', cantidad: r.generadas },
        })
      }
    } catch {
      // best-effort
    }
    try {
      const u = await this.users.findById(userId)
      if (u) await this.digest.enviarSiToca(u)
    } catch {
      // best-effort
    }
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
    const correo = correoReset(user.displayName, link);
    await this.email.enviar({
      para: user.email,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
    });
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
    cambios: {
      displayName?: string;
      idioma?: 'es' | 'en';
      recibirDigest?: boolean;
      fotoUrl?: string;
    },
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
      fotoUrl: user.fotoUrl ?? null,
      emailVerificado: user.emailVerificado,
      rol: user.rol,
      debeCambiarPassword: user.debeCambiarPassword,
      idioma: (user.idioma as 'es' | 'en') || 'es',
      recibirDigest: user.recibirDigest ?? true,
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
