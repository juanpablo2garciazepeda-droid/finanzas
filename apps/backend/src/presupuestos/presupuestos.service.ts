import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Presupuesto } from './presupuesto.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

@Injectable()
export class PresupuestosService extends AuthCrudService<Presupuesto> {
  constructor(
    @InjectRepository(Presupuesto)
    private readonly repoRef: Repository<Presupuesto>,
  ) {
    super();
  }

  protected get repo(): Repository<Presupuesto> {
    return this.repoRef;
  }
}
