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

  async update(userId: string, input: Partial<Ajuste>): Promise<Ajuste> {
    // Patrón "load → merge → save", igual que UsersService.actualizarPerfil.
    // Si mandáramos `repo.save({ ...rest, userId })` con un partial, TypeORM
    // haría un UPDATE con solo esos campos y devolvería la entidad con
    // SOLO esos campos poblados. En el frontend, `ajusteDesdeApi` mapea
    // `undefined` a `undefined`, y el `setDatos(prev => ...ajustes: nuevos)`
    // pisaba tema/acento/cicloPago con `undefined` cada vez que cambiabas
    // uno solo. Resultado: "cambié tema y se borró el acento" (y simétrico).
    const actual = await this.repo.findOne({ where: { userId } });
    if (!actual) throw new NotFoundException('ajuste not found');
    for (const [clave, valor] of Object.entries(input)) {
      if (valor !== undefined && clave !== 'userId') {
        (actual as Record<string, unknown>)[clave] = valor;
      }
    }
    return this.repo.save(actual);
  }
}
