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
    return this.pagosRepo.save(
      this.pagosRepo.create({ ...input, userId, deudaId }),
    );
  }

  async removePago(userId: string, pagoId: string): Promise<void> {
    const result = await this.pagosRepo.delete({ id: pagoId, userId });
    if (!result.affected) {
      throw new Error('not found');
    }
  }
}
