import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../users/user.entity';

/**
 * Marca un endpoint (o controller) con los roles que pueden acceder.
 * Se aplica junto con `RolesGuard`.
 *
 * @example
 *   @Roles('admin')
 *   @Get('usuarios')
 *   listar() { … }
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
