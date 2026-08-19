import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ajuste } from './ajuste.entity';

/**
 * Los campos que `PATCH /ajustes` puede tocar. Lista explícita y no un
 * `Object.entries(input)` genérico por dos razones: `userId` (la PK) y
 * `actualizadoEn` quedan fuera por construcción y no por una comparación de
 * cadenas que se olvida al refactorizar, y el `satisfies` hace que
 * TypeScript falle aquí mismo si alguien renombra una columna de `Ajuste`.
 */
const CAMPOS_EDITABLES = [
  'moneda',
  'locale',
  'ingresoMensual',
  'cicloPago',
  'saldoInicial',
  'saldoInicialFecha',
  'tema',
  'acento',
  'diasAvisoVencimiento',
  'umbralPrecaucion',
  'notificacionesActivas',
  'ultimaRevisionVencimientos',
] as const satisfies readonly (keyof Ajuste)[];

/**
 * Escribir un campo cuya clave sale de un bucle. El genérico ata la clave
 * con el tipo de su valor, así que la asignación a la entidad sí queda
 * verificada; hacerlo en línea obligaría a un
 * `(actual as Record<string, unknown>)[clave]`, que TypeScript rechaza —
 * `Ajuste` es una clase sin index signature — y que además apagaría la
 * comprobación de tipos de toda la asignación.
 */
function asignar<K extends keyof Ajuste>(destino: Ajuste, clave: K, valor: Ajuste[K]): void {
  destino[clave] = valor;
}

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
    for (const clave of CAMPOS_EDITABLES) {
      const valor = input[clave];
      if (valor !== undefined) {
        asignar(actual, clave, valor);
      }
    }
    return this.repo.save(actual);
  }
}
