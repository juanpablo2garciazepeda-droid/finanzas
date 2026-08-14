import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GastoRecurrente } from './gasto-recurrente.entity';
import { Categoria } from '../categorias/categoria.entity';
import { Transaccion } from '../transacciones/transaccion.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

interface CrearRecurrente {
  tipo: 'ingreso' | 'egreso';
  monto: string | number;
  categoriaId: string;
  metodoPago: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';
  nota?: string;
  diaDelMes: number;
  iniciaEn: string;
  terminaEn?: string | null;
  activo?: boolean;
}

@Injectable()
export class RecurrentesService extends AuthCrudService<GastoRecurrente> {
  constructor(
    @InjectRepository(GastoRecurrente)
    private readonly repoEntidad: Repository<GastoRecurrente>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Transaccion)
    private readonly transacciones: Repository<Transaccion>,
  ) {
    super();
  }

  protected get repo(): Repository<GastoRecurrente> {
    return this.repoEntidad;
  }

  async listar(
    userId: string,
    extra: FindOptionsWhere<GastoRecurrente> = {},
  ): Promise<GastoRecurrente[]> {
    return this.list(userId, extra);
  }

  async crear(userId: string, dto: CrearRecurrente): Promise<GastoRecurrente> {
    if (dto.diaDelMes < 1 || dto.diaDelMes > 28) {
      throw new BadRequestException('diaDelMes debe estar entre 1 y 28.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.iniciaEn)) {
      throw new BadRequestException('iniciaEn debe tener formato YYYY-MM-DD.');
    }
    if (dto.terminaEn && !/^\d{4}-\d{2}-\d{2}$/.test(dto.terminaEn)) {
      throw new BadRequestException('terminaEn debe tener formato YYYY-MM-DD.');
    }
    // La categoría debe ser del propio usuario.
    const cat = await this.categorias.findOne({
      where: { id: dto.categoriaId, userId },
    });
    if (!cat) {
      throw new BadRequestException('Categoría inválida.');
    }
    if (cat.archivada) {
      throw new BadRequestException('La categoría está archivada.');
    }
    if (cat.tipo !== dto.tipo) {
      throw new BadRequestException('La categoría no coincide con el tipo.');
    }
    return this.create(userId, {
      tipo: dto.tipo,
      monto: String(dto.monto),
      categoriaId: dto.categoriaId,
      metodoPago: dto.metodoPago,
      nota: dto.nota ?? '',
      diaDelMes: dto.diaDelMes,
      iniciaEn: dto.iniciaEn,
      terminaEn: dto.terminaEn ?? null,
      activo: dto.activo ?? true,
      ultimoGeneradoEn: null,
    });
  }

  async actualizar(
    userId: string,
    id: string,
    dto: Partial<CrearRecurrente>,
  ): Promise<GastoRecurrente> {
    if (dto.diaDelMes !== undefined && (dto.diaDelMes < 1 || dto.diaDelMes > 28)) {
      throw new BadRequestException('diaDelMes debe estar entre 1 y 28.');
    }
    if (dto.terminaEn && !/^\d{4}-\d{2}-\d{2}$/.test(dto.terminaEn)) {
      throw new BadRequestException('terminaEn debe tener formato YYYY-MM-DD.');
    }
    const cambios: Record<string, unknown> = {}
    if (dto.tipo) cambios.tipo = dto.tipo
    if (dto.monto !== undefined) cambios.monto = String(dto.monto)
    if (dto.categoriaId) {
      const cat = await this.categorias.findOne({
        where: { id: dto.categoriaId, userId },
      })
      if (!cat) throw new BadRequestException('Categoría inválida.')
      if (cat.tipo !== (dto.tipo ?? cat.tipo)) {
        throw new BadRequestException('La categoría no coincide con el tipo.')
      }
      cambios.categoriaId = dto.categoriaId
    }
    if (dto.metodoPago) cambios.metodoPago = dto.metodoPago
    if (dto.nota !== undefined) cambios.nota = dto.nota
    if (dto.diaDelMes !== undefined) cambios.diaDelMes = dto.diaDelMes
    if (dto.iniciaEn) cambios.iniciaEn = dto.iniciaEn
    if (dto.terminaEn !== undefined) cambios.terminaEn = dto.terminaEn
    if (dto.activo !== undefined) cambios.activo = dto.activo
    return this.update(userId, id, cambios)
  }

  async eliminar(userId: string, id: string): Promise<void> {
    return this.remove(userId, id)
  }

  /**
   * Procesa los recurrentes del usuario y crea las transacciones que tocan
   * en el mes actual. Devuelve la cantidad generada.
   *
   * "Tocar" = hoy >= iniciaEn y (terminaEn null o hoy <= terminaEn) y
   *            ya pasó el día del mes y (ultimoGeneradoEn es null o
   *            corresponde a un periodo anterior).
   */
  async ejecutarPendientes(
    userId: string,
    hoy: string,
  ): Promise<{ generadas: number; errores: string[] }> {
    const todas = await this.repoEntidad.find({
      where: { userId, activo: true },
    })
    if (todas.length === 0) return { generadas: 0, errores: [] }

    let generadas = 0
    const errores: string[] = []

    for (const r of todas) {
      if (r.iniciaEn > hoy) continue
      if (r.terminaEn && hoy > r.terminaEn) continue

      const [yyyy, mm] = hoy.split('-').map(Number)
      const fechaToca = `${hoy.slice(0, 7)}-${String(r.diaDelMes).padStart(2, '0')}`
      if (fechaToca > hoy) continue // aún no llega el día
      if (r.ultimoGeneradoEn && r.ultimoGeneradoEn >= fechaToca) continue

      try {
        await this.transacciones.insert({
          userId,
          tipo: r.tipo,
          monto: r.monto,
          categoriaId: r.categoriaId,
          fecha: fechaToca,
          metodoPago: r.metodoPago,
          nota: r.nota || (r.tipo === 'ingreso' ? 'Ingreso recurrente' : 'Gasto recurrente'),
        })
        await this.repoEntidad.update({ id: r.id }, { ultimoGeneradoEn: fechaToca })
        generadas++
      } catch (err) {
        errores.push(`${r.id}: ${err instanceof Error ? err.message : 'error'}`)
      }
    }
    return { generadas, errores }
  }
}
