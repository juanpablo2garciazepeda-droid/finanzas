import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  CambiarPasswordDto,
  CambiarCorreoDto,
  LoginDto,
  OlvidePasswordDto,
  RegisterDto,
  RestablecerPasswordDto,
  TokenDto,
  ActualizarPerfilDto,
  EliminarCuentaDto,
  VerificarCodigoDto,
  SolicitarCodigoRegistroDto,
  ConfirmarCodigoRegistroDto,
} from './auth.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /**
   * Alta en tres llamadas: pedir código → canjearlo → crear la cuenta.
   *
   * El correo se confirma antes de que exista el usuario, así que quien
   * abandona el alta en la contraseña no deja una cuenta huérfana detrás.
   */
  @Post('codigo-registro')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  solicitarCodigoRegistro(
    @Body() body: SolicitarCodigoRegistroDto,
    @Req() req: Request,
  ) {
    return this.auth.solicitarCodigoRegistro(body.email, req);
  }

  @Post('confirmar-codigo-registro')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmarCodigoRegistro(
    @Body() body: ConfirmarCodigoRegistroDto,
    @Req() req: Request,
  ) {
    return this.auth.confirmarCodigoRegistro(body.email, body.codigo, req);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() body: RegisterDto, @Req() req: Request) {
    return this.auth.register(
      body.email,
      body.password,
      body.displayName,
      body.tokenRegistro,
      body.fotoUrl,
      req,
    );
  }

  /**
   * Canje del código de 6 dígitos. Más estricto que el resto: 10 por minuto
   * por IP. Un código son un millón de combinaciones y la fila ya lleva su
   * propio contador de intentos, pero el límite por IP es lo que impide
   * repartir la fuerza bruta entre muchas cuentas a la vez.
   */
  @Post('verificar-codigo')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verificarCodigo(@Body() body: VerificarCodigoDto, @Req() req: Request) {
    return this.auth.verificarCodigo(body.email, body.codigo, req);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.login(body.email, body.password, req);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@CurrentUser() user: JwtPayload) {
    const u = await this.auth.validarPayload(user);
    return this.auth.toPublic(u);
  }

  // ── Verificación de email ───────────────────────────────────────────────

  @Post('verificar-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verificarEmail(@Body() body: TokenDto, @Req() req: Request) {
    return this.auth.verificarEmail(body.token, {
      nuevoEmail: body.nuevoEmail,
      request: req,
    });
  }

  // Manda correo, así que se limita igual que el registro: sin tope, es un
  // cañón gratis para inundar la bandeja de cualquiera con solo su dirección.
  @Post('reenviar-verificacion')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  reenviarVerificacion(@Body() body: OlvidePasswordDto, @Req() req: Request) {
    return this.auth.reenviarVerificacion(body.email, req);
  }

  // ── Olvidé / restablecer password ───────────────────────────────────────

  @Post('olvide-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  olvidePassword(@Body() body: OlvidePasswordDto, @Req() req: Request) {
    return this.auth.olvidePassword(body.email, req);
  }

  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  restablecerPassword(
    @Body() body: RestablecerPasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.restablecerPassword(body.token, body.password, req);
  }

  // ── Cuenta (con sesión) ─────────────────────────────────────────────────

  @Patch('password')
  @UseGuards(AuthGuard('jwt'))
  cambiarPassword(
    @CurrentUser() user: JwtPayload,
    @Body() body: CambiarPasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.cambiarPassword(user.sub, body.actual, body.nuevo, req);
  }

  @Patch('perfil')
  @UseGuards(AuthGuard('jwt'))
  actualizarPerfil(
    @CurrentUser() user: JwtPayload,
    @Body() body: ActualizarPerfilDto,
    @Req() req: Request,
  ) {
    return this.auth.actualizarPerfil(user.sub, body, req);
  }

  @Post('cambiar-correo')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  cambiarCorreo(
    @CurrentUser() user: JwtPayload,
    @Body() body: CambiarCorreoDto,
    @Req() req: Request,
  ) {
    return this.auth.solicitarCambioCorreo(user.sub, body.nuevoEmail, req);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.auth.logoutAll(user.sub, req);
  }

  @Delete('cuenta')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  eliminarCuenta(
    @CurrentUser() user: JwtPayload,
    @Body() body: EliminarCuentaDto,
    @Req() req: Request,
  ) {
    return this.auth.eliminarCuenta(user.sub, body.password, req);
  }
}
