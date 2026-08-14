import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deuda } from './deuda.entity';
import { PagoDeuda } from './pago-deuda.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

@Injectable()
export class DeudasService extends AuthCrudService<Deuda> {
  constructor(
    @InjectRepository(Deuda)
    private readonly deudasRepo: Repository<Deuda>,
    @InjectRepository(PagoDeuda)
    private readonly pagosRepo: Repository<PagoDeuda>,
  ) {
    super();
  }

  protected get repo(): Repository<Deuda> {
    return this.deudasRepo;
  }

  listPagos(userId: string, deudaId: string): Promise<PagoDeuda[]> {
    return this.pagosRepo.find({
      where: { userId, deudaId },
      order: { fecha: 'DESC' },
    });
  }

  addPago(
    userId: string,
    deudaId: string,
    input: Partial<PagoDeuda>,
  ): Promise<PagoDeuda> {
    return this.pagosRepo
      .save(this.pagosRepo.create({ ...input, userId, deudaId }))
      .then(async (pago) => {
        await this.recalcularDeuda(userId, deudaId)
        return pago
      })
  }

  async removePago(userId: string, pagoId: string): Promise<void> {
    const pago = await this.pagosRepo.findOne({ where: { id: pagoId, userId } })
    if (!pago) throw new Error('not found')
    await this.pagosRepo.delete({ id: pagoId, userId })
    await this.recalcularDeuda(userId, pago.deudaId)
  }

  /** Recalcula saldo y liquidada a partir de montoOriginal menos la suma de pagos. */
  private async recalcularDeuda(userId: string, deudaId: string): Promise<void> {
    const deuda = await this.deudasRepo.findOne({ where: { id: deudaId, userId } })
    if (!deuda) return
    const pagos = await this.pagosRepo.find({ where: { userId, deudaId } })
    const totalPagado = pagos.reduce(
      (acc, p) => acc + BigInt(p.monto || '0'),
      BigInt(0),
    )
    const original = BigInt(deuda.montoOriginal || '0')
    const saldo = original > totalPagado ? (original - totalPagado).toString() : '0'
    await this.deudasRepo.update(
      { id: deudaId, userId },
      { saldoActual: saldo, liquidada: saldo === '0' },
    )
  }
}
