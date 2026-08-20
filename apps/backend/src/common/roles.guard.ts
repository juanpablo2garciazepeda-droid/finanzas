import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../auth/auth.service';
import { ROLES_KEY } from './roles.decorator';
import { RolUsuario } from '../users/user.entity';

/**
 * Verifica que el JWT del request incluya al menos uno de los roles
 * declarados con `@Roles()`.
 *
 * Si el endpoint NO tiene `@Roles()`, el guard no restringe: lo decide
 * la lógica de cada controller (por ejemplo `@UseGuards(JwtGuard)` solo
 * verifica que haya sesión).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Sin @Roles(): no restringe. Que cada controller ponga sus guards.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      // Sin sesión no debería llegar aquí (JwtAuthGuard corre antes), pero
      // por si acaso, devolvemos 401 — sin embargo la convención es que
      // un endpoint con @Roles() también tenga JwtAuthGuard.
      throw new ForbiddenException('Sin sesión')
    }
    if (!required.includes(user.rol)) {
      throw new ForbiddenException('No tienes permisos para esta acción')
    }
    return true
  }
}
