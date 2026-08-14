import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './auth.service';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-production',
    });
  }

  /**
   * Cada request con JWT pasa por aquí. Si la versión del token no coincide
   * con la de la BD (porque cambió password o cerró todas las sesiones),
   * lanza 401 y el frontend desloguea.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    try {
      await this.auth.validarPayload(payload);
    } catch {
      throw new UnauthorizedException('Sesión inválida o revocada.');
    }
    return payload;
  }
}
