import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaccion } from './transaccion.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

@Injectable()
export class TransaccionesService extends AuthCrudService<Transaccion> {
  constructor(
    @InjectRepository(Transaccion)
    private readonly repoRef: Repository<Transaccion>,
  ) {
    super();
  }

  protected get repo(): Repository<Transaccion> {
    return this.repoRef;
  }
}
