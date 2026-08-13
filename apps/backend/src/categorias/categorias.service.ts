import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './categoria.entity';
import { AuthCrudService } from '../common/auth-crud.controller';

@Injectable()
export class CategoriasService extends AuthCrudService<Categoria> {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriasRepo: Repository<Categoria>,
  ) {
    super();
  }

  protected get repo(): Repository<Categoria> {
    return this.categoriasRepo;
  }
}
