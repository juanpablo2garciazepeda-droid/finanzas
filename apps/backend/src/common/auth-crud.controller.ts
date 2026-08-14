import { Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';

/**
 * Generic CRUD service for any entity owned by a single user.
 *
 * All reads, updates and deletes are scoped by `userId` — this is the
 * server-side counterpart of the RLS policies the schema would have in a
 * pure-Postgres world. The `userId` column is the only thing we trust
 * from the request, hence the `CurrentUser` decorator instead of any
 * path/body param.
 */
@Injectable()
export abstract class AuthCrudService<Entity extends { userId: string }> {
  protected abstract get repo(): Repository<Entity>;

  list(userId: string, extra: FindOptionsWhere<Entity> = {}): Promise<Entity[]> {
    return this.repo.find({
      where: { ...extra, userId } as FindOptionsWhere<Entity>,
    });
  }

  /**
   * Devuelve la fila o lanza 404.
   *
   * El filtro por `userId` hace que "no existe" y "es de otra persona" sean el
   * mismo caso, que es justo lo que se quiere: un 403 en el segundo confirmaría
   * que ese id existe y de paso permitiría enumerar los registros ajenos.
   *
   * Antes devolvía `null` y el controlador lo serializaba como un 200 con el
   * cuerpo vacío: no filtraba datos, pero le decía al cliente "aquí está" de
   * algo que no está.
   */
  async findOne(userId: string, id: string): Promise<Entity> {
    const fila = await this.repo.findOne({
      where: { id, userId } as unknown as FindOptionsWhere<Entity>,
    });
    if (!fila) throw new NotFoundException('No encontrado.');
    return fila;
  }

  create(userId: string, input: DeepPartial<Entity>): Promise<Entity> {
    const payload = { ...input, userId } as DeepPartial<Entity>;
    const entity = this.repo.create(payload);
    return this.repo.save(entity);
  }

  async update(
    userId: string,
    id: string,
    input: DeepPartial<Entity>,
  ): Promise<Entity> {
    // `findOne` ya lanza 404 si no es suya o no existe.
    const existing = await this.findOne(userId, id);
    // Strip userId from the patch so callers can't re-parent a record.
    const { userId: _ignored, ...rest } = input as { userId?: string };
    Object.assign(existing, rest);
    return this.repo.save(existing);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.repo.delete({
      id,
      userId,
    } as unknown as FindOptionsWhere<Entity>);
    // `new Error` salía como 500 con "Internal server error": un id ajeno o
    // inexistente no es una falla del servidor, es un 404.
    if (!result.affected) {
      throw new NotFoundException('No encontrado.');
    }
  }
}
