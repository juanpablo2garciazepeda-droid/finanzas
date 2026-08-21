// ─── Runner de migraciones SQL ──────────────────────────────────────────────
//
// Dokploy reconstruye y reinicia el contenedor en cada push a `main`. Las
// migraciones son archivos `migracion-YYYY-MM-DD-*.sql` en `apps/backend/sql/`
// y, hasta ahora, se aplicaban a mano:
//
//   docker exec -i <postgres> psql -U finanzas -d finanzas \
//     < apps/backend/sql/migracion-2026-08-21-avisos-vencimiento.sql
//
// En producción ese acceso manual ya no es viable: el código que consulta
// columnas nuevas (TypeORM mete el `SELECT` de la entidad al mapear) sube en
// el mismo push que crea la columna, así que si el schema no está actualizado
// cuando NestJS empieza a servir tráfico, /inicio responde 500 y la app se
// cae para todos.
//
// Este runner se ejecuta en el arranque del contenedor, ANTES de que NestJS
// abra el puerto. Solo actúa cuando `MIGRACIONES_AUTOMATICAS=true`:
//
//   · Crea una tabla `public.schema_migrations` con la lista de archivos ya
//     aplicados. Si el contenedor se reinicia, no vuelve a correr los viejos.
//   · Recorre `sql/migracion-*.sql` en orden lexicográfico (que coincide con
//     el orden cronológico porque el nombre empieza con YYYY-MM-DD).
//   · Para cada archivo nuevo, lo ejecuta dentro de una transacción. Si algo
//     falla, hace rollback y la promesa rechaza: el contenedor sale con
//     error y Dokploy lo marca como fallido en vez de servir una app rota.
//   · Es idempotente en dos sentidos: la tabla de control evita re-aplicar
//     migraciones, y los propios archivos usan `add column if not exists`,
//     `create table if not exists`, etc. Un re-deploy es seguro.
//
// Por qué NO se acopla al `migrationsRun` de TypeORM: las migraciones son SQL
// crudo (crean triggers, funciones, índices que el ORM no modela), y el
// `data-source.ts` ya apunta a `dist/database/migrations/` que está vacío.
// Mezclar las dos cosas terminaría con migraciones a medias.

import { Client, ClientConfig } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIGRATIONS_TABLE = 'schema_migrations';
const MIGRATIONS_DIR_NAME = 'sql';

const REQUIRED_ENV = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
] as const;

/**
 * Resuelve la ruta al directorio de SQL en el contenedor.
 *
 * `__dirname` al ejecutarse desde `dist/migraciones.js` vale `/app/dist`,
 * así que `../sql` apunta a `/app/sql`, que es donde el Dockerfile copia los
 * archivos (`COPY sql ./sql` justo antes del `CMD`).
 *
 * Si alguien mueve el archivo de sitio, esto se cae con un error claro en
 * vez de migrar una carpeta equivocada en silencio.
 */
function resolveSqlDir(): string {
  const candidate = resolve(__dirname, '..', MIGRATIONS_DIR_NAME);
  return candidate;
}

function readMigrationFiles(sqlDir: string): string[] {
  const entries = readdirSync(sqlDir);
  return entries
    .filter((name) => /^migracion-.*\.sql$/.test(name))
    .sort();
}

function pgConfig(): ClientConfig {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `MIGRACIONES_AUTOMATICAS requiere ${missing.join(', ')} en el entorno`,
    );
  }
  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    // El SSL se negocia con la variable estándar `PGSSLMODE` por si la base
    // vive detrás de un proxy que lo pide (managed Postgres, etc.). Si no
    // está definida, asumimos plaintext, que es lo que usa Dokploy en su red.
    ssl:
      process.env.PGSSLMODE === 'require' ||
      process.env.PGSSLMODE === 'verify-full'
        ? { rejectUnauthorized: false }
        : false,
  };
}

export async function runMigrations(): Promise<void> {
  if (process.env.MIGRACIONES_AUTOMATICAS !== 'true') {
    return;
  }

  const sqlDir = resolveSqlDir();
  const files = readMigrationFiles(sqlDir);

  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[migraciones] MIGRACIONES_AUTOMATICAS=true pero no hay archivos ` +
        `migracion-*.sql en ${sqlDir}. Revisar el COPY del Dockerfile.`,
    );
    return;
  }

  const client = new Client(pgConfig());
  await client.connect();

  try {
    // La tabla de control se crea aquí y no en `esquema.sql` a propósito:
    // el esquema base es la foto de un punto en el tiempo y no debe llevar
    // marcas de runtime. Crearla con `if not exists` permite levantar una
    // base de datos existente sin tener que correr un script extra.
    await client.query(`
      create table if not exists public.${MIGRATIONS_TABLE} (
        id text primary key,
        aplicada_en timestamptz not null default now()
      )
    `);

    const { rows: aplicadas } = await client.query<{ id: string }>(
      `select id from public.${MIGRATIONS_TABLE}`,
    );
    const yaAplicadas = new Set(
      aplicadas.map((row: { id: string }) => row.id),
    );

    // eslint-disable-next-line no-console
    console.log(
      `[migraciones] ${files.length} archivo(s) encontrado(s), ` +
        `${yaAplicadas.size} ya aplicado(s).`,
    );

    let nuevas = 0;
    for (const file of files) {
      if (yaAplicadas.has(file)) {
        continue;
      }

      const sqlPath = join(sqlDir, file);
      const sql = readFileSync(sqlPath, 'utf-8');

      // eslint-disable-next-line no-console
      console.log(`[migraciones] aplicando ${file}`);

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          `insert into public.${MIGRATIONS_TABLE} (id) values ($1)`,
          [file],
        );
        await client.query('commit');
        nuevas += 1;
        // eslint-disable-next-line no-console
        console.log(`[migraciones] ${file} aplicada`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(
          `falló la migración ${file}: ${(err as Error).message}`,
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[migraciones] listo. ${nuevas} migracion(es) nueva(s) aplicada(s), ` +
        `${yaAplicadas.size + nuevas} en total.`,
    );
  } finally {
    await client.end();
  }
}
