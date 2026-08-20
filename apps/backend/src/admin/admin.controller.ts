import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

/**
 * Endpoints exclusivos para usuarios con `rol: 'admin'`. Todos requieren
 * sesión válida (JwtAuthGuard) Y rol admin (RolesGuard). Si el JWT no tiene
 * `rol: 'admin'`, RolesGuard lanza 403.
 */
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Lista todos los usuarios. */
  @Get('usuarios')
  listar() {
    return this.admin.listarUsuarios()
  }

  /** Detalle de un usuario + conteos de sus datos. */
  @Get('usuarios/:id')
  detalle(@Param('id') id: string) {
    return this.admin.detalleUsuario(id)
  }

  /** Borra un usuario (cascada en categorías, transacciones, etc.). */
  @Delete('usuarios/:id')
  async eliminar(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    await this.admin.eliminarUsuario(id, admin.sub, request)
    return { ok: true }
  }

  /**
   * Fuerza un reset de contraseña: marca `debeCambiarPassword`, invalida
   * sesiones y envía un correo al usuario con el enlace de reset.
   */
  @Post('usuarios/:id/forzar-reset')
  async forzarReset(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() request: Request,
  ): Promise<{ mensaje: string }> {
    return this.admin.forzarResetPassword(id, admin.sub, request)
  }

  /**
   * Cambia el rol de un usuario. Útil para promover/quitar admins. El admin
   * no puede cambiar su propio rol (para evitar quedarse sin acceso).
   */
  @Patch('usuarios/:id/rol')
  async cambiarRol(
    @Param('id') id: string,
    @Body() body: { rol: 'usuario' | 'admin' },
    @CurrentUser() admin: JwtPayload,
  ): Promise<{ ok: true }> {
    if (id === admin.sub) {
      return { ok: true } // No error, simplemente ignora: nadie se quita admin a sí mismo
    }
    await this.admin.asignarRol(id, body.rol)
    return { ok: true }
  }
}
