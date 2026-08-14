import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditoriaService } from './auditoria.service';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

@Controller('auth/auditoria')
@UseGuards(AuthGuard('jwt'))
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  /**
   * Eventos de auth del propio usuario: logins, cambios de password, etc.
   * El frontend lo muestra en "Actividad reciente" o similar.
   */
  @Get()
  async mios(
    @CurrentUser() user: JwtPayload,
    @Query('limite') limite?: string,
  ) {
    const n = limite ? Number(limite) : 50;
    const eventos = await this.auditoria.listarPorUsuario(user.sub, n);
    return eventos.map((e) => ({
      id: e.id,
      accion: e.accion,
      detalles: e.detalles,
      ip: e.ip,
      creadoEn: e.creadoEn.toISOString(),
    }));
  }
}
