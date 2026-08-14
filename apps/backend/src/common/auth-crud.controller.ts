import {
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import {
  DeepPartial,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

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

  findOne(userId: string, id: string): Promise<Entity | null> {
    return this.repo.findOne({
      where: { id, userId } as unknown as FindOptionsWhere<Entity>,
    });
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
    const existing = await this.findOne(userId, id);
    if (!existing) {
      throw new Error('not found');
    }
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
    if (!result.affected) {
      throw new Error('not found');
    }
  }
}
