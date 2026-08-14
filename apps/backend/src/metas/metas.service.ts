import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meta } from './meta.entity';
import { AporteMeta } from './aporte-meta.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

@Injectable()
export class MetasService extends AuthCrudService<Meta> {
  constructor(
    @InjectRepository(Meta)
    private readonly metasRepo: Repository<Meta>,
    @InjectRepository(AporteMeta)
    private readonly aportesRepo: Repository<AporteMeta>,
  ) {
    super();
  }

  protected get repo(): Repository<Meta> {
    return this.metasRepo;
  }

  listAportes(userId: string, metaId: string): Promise<AporteMeta[]> {
    return this.aportesRepo.find({
      where: { userId, metaId },
      order: { fecha: 'DESC' },
    });
  }

  /** Override: completa defaults NOT NULL (montoActual, prioridad, completada). */
  async create(userId: string, input: Partial<Meta>): Promise<Meta> {
    const payload: Partial<Meta> = { ...input, userId }
    if (payload.montoActual === undefined) payload.montoActual = '0'
    if (payload.prioridad === undefined) payload.prioridad = 1
    if (payload.completada === undefined) payload.completada = false
    if (payload.icono === undefined) payload.icono = 'Target'
    return super.create(userId, payload)
  }

  addAporte(
    userId: string,
    metaId: string,
    input: Partial<AporteMeta>,
  ): Promise<AporteMeta> {
    return this.aportesRepo
      .save(this.aportesRepo.create({ ...input, userId, metaId }))
      .then(async (aporte) => {
        await this.recalcularMeta(userId, metaId)
        return aporte
      })
  }

  async removeAporte(userId: string, aporteId: string): Promise<void> {
    const aporte = await this.aportesRepo.findOne({ where: { id: aporteId, userId } })
    if (!aporte) throw new Error('not found')
    await this.aportesRepo.delete({ id: aporteId, userId })
    await this.recalcularMeta(userId, aporte.metaId)
  }

  /** Suma los aportes y actualiza monto_actual + completada en la meta. */
  private async recalcularMeta(userId: string, metaId: string): Promise<void> {
    const meta = await this.metasRepo.findOne({ where: { id: metaId, userId } })
    if (!meta) return
    const aportes = await this.aportesRepo.find({ where: { userId, metaId } })
    const total = aportes.reduce(
      (acc, a) => acc + BigInt(a.monto || '0'),
      BigInt(0),
    )
    const objetivo = BigInt(meta.montoObjetivo || '0')
    await this.metasRepo.update(
      { id: metaId, userId },
      {
        montoActual: total.toString(),
        completada: objetivo > BigInt(0) && total >= objetivo,
      },
    )
  }
}
