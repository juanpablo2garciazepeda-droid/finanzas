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

  addAporte(
    userId: string,
    metaId: string,
    input: Partial<AporteMeta>,
  ): Promise<AporteMeta> {
    return this.aportesRepo.save(
      this.aportesRepo.create({ ...input, userId, metaId }),
    );
  }

  async removeAporte(userId: string, aporteId: string): Promise<void> {
    const result = await this.aportesRepo.delete({ id: aporteId, userId });
    if (!result.affected) {
      throw new Error('not found');
    }
  }
}
