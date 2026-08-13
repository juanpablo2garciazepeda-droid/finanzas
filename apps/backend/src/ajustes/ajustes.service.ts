import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ajuste } from './ajuste.entity';

@Injectable()
export class AjustesService {
  constructor(
    @InjectRepository(Ajuste)
    private readonly repo: Repository<Ajuste>,
  ) {}

  async getOrCreate(userId: string): Promise<Ajuste> {
    let row = await this.repo.findOne({ where: { userId } });
    if (row) return row;
    // Postgres ON CONFLICT DO NOTHING semantics: el INSERT no debe tronar
    // si dos requests de /me entran en paralelo al registrarse.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Ajuste)
      .values({ userId })
      .orIgnore()
      .execute();
    row = await this.repo.findOne({ where: { userId } });
    if (!row) throw new NotFoundException('ajuste not found after create');
    return row;
  }

  update(userId: string, input: Partial<Ajuste>): Promise<Ajuste> {
    // Strip userId del patch para que el cliente no se re-asigne filas.
    const { userId: _ignored, ...rest } = input as { userId?: string };
    return this.repo.save({ ...rest, userId } as Ajuste);
  }
}
