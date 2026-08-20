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
import { SkipThrottle } from '@nestjs/throttler';
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
 *
 * Las operaciones de admin son por naturaleza batch: un admin limpiando
 * cuentas de smoke tests o de spam no puede pararse cada 100 req. Por eso
 * el controller entero se salta el throttler — el riesgo de abuso es bajo
 * porque ya pasó por la barrera del rol admin.
 */
@SkipThrottle({ default: true })
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
   * Borra varios usuarios en una sola transacción. Devuelve el resultado por
   * id: el front puede mostrar qué falló (no incluir al propio admin, ids
   * inexistentes, sistema sin admins restantes) sin tener que reconciliar
   * estado entre la lista y el servidor.
   */
  @Post('usuarios/eliminar-lote')
  async eliminarLote(
    @Body() body: { ids: string[] },
    @CurrentUser() admin: JwtPayload,
    @Req() request: Request,
  ): Promise<{
    eliminados: string[]
    omitidos: Array<{ id: string; razon: string }>
  }> {
    return this.admin.eliminarUsuariosLote(body.ids, admin.sub, request)
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
