import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
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

  /**
   * `esSistema` lo decide el servidor, no el cliente.
   *
   * Las categorías de sistema son las 17 que siembra el trigger al dar de alta
   * la cuenta, y la interfaz las protege de borrarse. Si el cliente pudiera
   * marcar la bandera, cualquiera se fabricaría categorías imborrables desde
   * su propia app y luego no habría forma de quitarlas sin tocar la base.
   */
  create(userId: string, input: DeepPartial<Categoria>): Promise<Categoria> {
    return super.create(userId, { ...input, esSistema: false });
  }

  /** Misma razón: un PATCH tampoco puede ascender una categoría a de sistema. */
  update(
    userId: string,
    id: string,
    input: DeepPartial<Categoria>,
  ): Promise<Categoria> {
    const { esSistema: _ignorado, ...resto } = input;
    return super.update(userId, id, resto);
  }
}
