// ─── Tipos mínimos para `pg` ───────────────────────────────────────────────
//
// El backend usa TypeORM para casi todo, así que `pg` queda detrás de un
// driver y nadie importa el módulo directamente. El runner de migraciones
// sí necesita un cliente propio (no queremos atar la ejecución de SQL crudo
// al ciclo de vida de TypeORM), y `@types/pg` no está entre las dependencias
// del proyecto. En vez de añadir un paquete para una función autocontenida,
// declaramos aquí las piezas que usamos.
declare module 'pg' {
  export interface ClientConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | { rejectUnauthorized: boolean };
  }

  export class Client {
    constructor(config: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<R = unknown>(
      queryText: string,
      values?: unknown[],
    ): Promise<{ rows: R[]; rowCount: number | null }>;
    query<R = unknown>(queryConfig: {
      text: string;
      values?: unknown[];
    }): Promise<{ rows: R[]; rowCount: number | null }>;
  }
}
