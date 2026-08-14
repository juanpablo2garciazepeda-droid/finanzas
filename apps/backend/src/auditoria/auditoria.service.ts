import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccionAuditoria, Auditoria } from './auditoria.entity';

export interface EventoAuditoria {
  usuarioId?: string | null;
  emailIntento?: string | null;
  accion: AccionAuditoria;
  detalles?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly repo: Repository<Auditoria>,
  ) {}

  /**
   * Registra un evento. Si algo falla, NO debe romper el flujo principal: la
   * auditoría no puede tumbar un login porque la BD se quedó sin espacio.
   */
  async registrar(evento: EventoAuditoria): Promise<void> {
    try {
      await this.repo.insert({
        usuarioId: evento.usuarioId ?? null,
        emailIntento: evento.emailIntento ?? null,
        accion: evento.accion,
        detalles: (evento.detalles ?? {}) as object,
        ip: evento.ip ?? null,
        userAgent: evento.userAgent ?? null,
      });
    } catch {
      // Silencio: la auditoría es best-effort.
    }
  }

  listarPorUsuario(usuarioId: string, limite = 50): Promise<Auditoria[]> {
    return this.repo.find({
      where: { usuarioId },
      order: { creadoEn: 'DESC' },
      take: Math.min(Math.max(limite, 1), 200),
    });
  }
}
