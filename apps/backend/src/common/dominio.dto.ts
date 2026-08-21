import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTOs de los recursos del dominio.
 *
 * Existen porque hasta ahora los controladores recibían `DeepPartial<Entidad>`,
 * que en tiempo de ejecución es simplemente `Object`. El `ValidationPipe` de
 * Nest se salta la validación cuando el tipo es `Object`, así que estos seis
 * recursos aceptaban literalmente cualquier cosa: un `monto` de `"hola"`, un
 * `tipo` inventado, una nota de diez megabytes o un `userId` ajeno.
 *
 * La base de datos frenaba una parte con sus `check`, pero lo hacía tarde y
 * mal: el usuario veía un 500 con un error de Postgres en vez de un 400 que
 * dijera qué campo está mal. Y los `text` sin tope no los frenaba nadie.
 *
 * Convenciones que se validan aquí y que vienen del dominio:
 *   · Los montos son enteros de centavos y viajan como cadena de dígitos,
 *     porque Postgres los guarda en `bigint` y JSON no tiene enteros de 64 bits.
 *   · Las fechas son `YYYY-MM-DD` y los periodos `YYYY-MM`, como texto.
 */

/** Centavos: dígitos, sin signo y sin punto. Hasta 15 cifras cabe en bigint. */
const MONTO = /^\d{1,15}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PERIODO = /^\d{4}-\d{2}$/;

const TIPOS = ['ingreso', 'egreso'] as const;
const METODOS = ['efectivo', 'debito', 'credito', 'transferencia', 'otro'] as const;
const PERIODICIDADES = ['semanal', 'quincenal', 'mensual', 'unico'] as const;

type Metodo = (typeof METODOS)[number];
type Periodicidad = (typeof PERIODICIDADES)[number];

// ── Transacciones ───────────────────────────────────────────────────────────

export class CrearTransaccionDto {
  @IsIn(TIPOS)
  tipo!: 'ingreso' | 'egreso';

  @Matches(MONTO, { message: 'monto debe ser un entero de centavos' })
  monto!: string;

  @IsUUID()
  categoriaId!: string;

  @Matches(FECHA, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha!: string;

  @IsIn(METODOS)
  metodoPago!: Metodo;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}

export class ActualizarTransaccionDto {
  @IsOptional() @IsIn(TIPOS) tipo?: 'ingreso' | 'egreso';
  @IsOptional() @Matches(MONTO) monto?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @Matches(FECHA) fecha?: string;
  @IsOptional() @IsIn(METODOS) metodoPago?: Metodo;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

// ── Categorías ──────────────────────────────────────────────────────────────

export class CrearCategoriaDto {
  @IsString() @MinLength(1) @MaxLength(40) nombre!: string;
  @IsIn(TIPOS) tipo!: 'ingreso' | 'egreso';
  @IsString() @MaxLength(40) icono!: string;

  // Hex de 6 dígitos: el color entra en un `style` y en el SVG de las gráficas.
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color debe ser un hex #RRGGBB' })
  color!: string;

  @IsOptional() @IsBoolean() archivada?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) orden?: number;

  /**
   * Se acepta y se ignora: el cliente lo manda siempre en `false`, pero dejar
   * que alguien marque `true` le permitiría fabricar categorías que la UI
   * protege de borrarse. El servicio lo fuerza a `false`.
   */
  @IsOptional() @IsBoolean() esSistema?: boolean;
}

export class ActualizarCategoriaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) nombre?: string;
  @IsOptional() @IsIn(TIPOS) tipo?: 'ingreso' | 'egreso';
  @IsOptional() @IsString() @MaxLength(40) icono?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsOptional() @IsBoolean() archivada?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) orden?: number;
}

// ── Presupuestos ────────────────────────────────────────────────────────────

export class CrearPresupuestoDto {
  /** `null` es el tope global del mes, no una categoría faltante. */
  @IsOptional() @IsUUID() categoriaId?: string | null;

  @Matches(MONTO) montoLimite!: string;
  @Matches(PERIODO, { message: 'periodo debe ser YYYY-MM' }) periodo!: string;
}

export class ActualizarPresupuestoDto {
  @IsOptional() @IsUUID() categoriaId?: string | null;
  @IsOptional() @Matches(MONTO) montoLimite?: string;
  @IsOptional() @Matches(PERIODO) periodo?: string;
}

// ── Deudas ──────────────────────────────────────────────────────────────────

export class CrearDeudaDto {
  @IsString() @MinLength(1) @MaxLength(80) acreedor!: string;
  @Matches(MONTO) montoOriginal!: string;
  @IsOptional() @Matches(MONTO) saldoActual?: string;

  /** Porcentaje anual con dos decimales. `null` cuando no se conoce. */
  @IsOptional()
  @Matches(/^\d{1,4}(\.\d{1,2})?$/, { message: 'tasaInteres debe ser un porcentaje' })
  tasaInteres?: string | null;

  @Matches(FECHA) fechaLimite!: string;
  @IsIn(PERIODICIDADES) periodicidad!: Periodicidad;
  @IsOptional() @Matches(MONTO) pagoMinimo?: string;
  @IsOptional() @IsBoolean() liquidada?: boolean;
}

export class ActualizarDeudaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) acreedor?: string;
  @IsOptional() @Matches(MONTO) montoOriginal?: string;
  @IsOptional() @Matches(MONTO) saldoActual?: string;
  @IsOptional() @Matches(/^\d{1,4}(\.\d{1,2})?$/) tasaInteres?: string | null;
  @IsOptional() @Matches(FECHA) fechaLimite?: string;
  @IsOptional() @IsIn(PERIODICIDADES) periodicidad?: Periodicidad;
  @IsOptional() @Matches(MONTO) pagoMinimo?: string;
  @IsOptional() @IsBoolean() liquidada?: boolean;
}

export class CrearPagoDto {
  @Matches(MONTO) monto!: string;
  @Matches(FECHA) fecha!: string;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

// ── Metas ───────────────────────────────────────────────────────────────────

export class CrearMetaDto {
  @IsString() @MinLength(1) @MaxLength(80) nombre!: string;
  @Matches(MONTO) montoObjetivo!: string;
  @IsOptional() @Matches(MONTO) montoActual?: string;
  @Matches(FECHA) fechaLimite!: string;
  @IsOptional() @IsInt() @Min(1) @Max(999) prioridad?: number;
  @IsOptional() @Matches(MONTO) aporteMensual?: string;
  @IsOptional() @IsString() @MaxLength(40) icono?: string;
  @IsOptional() @IsBoolean() completada?: boolean;
}

export class ActualizarMetaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nombre?: string;
  @IsOptional() @Matches(MONTO) montoObjetivo?: string;
  @IsOptional() @Matches(MONTO) montoActual?: string;
  @IsOptional() @Matches(FECHA) fechaLimite?: string;
  @IsOptional() @IsInt() @Min(1) @Max(999) prioridad?: number;
  @IsOptional() @Matches(MONTO) aporteMensual?: string;
  @IsOptional() @IsString() @MaxLength(40) icono?: string;
  @IsOptional() @IsBoolean() completada?: boolean;
}

export class CrearAporteDto {
  @Matches(MONTO) monto!: string;
  @Matches(FECHA) fecha!: string;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

export class ActualizarAjustesDto {
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'moneda debe ser un código ISO de 3 letras' })
  moneda?: string;

  @IsOptional()
  @Matches(/^[a-z]{2}-[A-Z]{2}$/, { message: 'locale debe ser como es-MX' })
  locale?: string;

  @IsOptional() @Matches(MONTO) ingresoMensual?: string;
  @IsOptional() @IsIn(['mensual', 'quincenal', 'semanal']) cicloPago?: string;
  @IsOptional() @Matches(MONTO) saldoInicial?: string;

  // Cadena vacía = nunca se declaró saldo. No es una fecha inválida.
  @IsOptional() @Matches(/^$|^\d{4}-\d{2}-\d{2}$/) saldoInicialFecha?: string;

  @IsOptional() @IsIn(['claro', 'oscuro', 'sistema']) tema?: string;
  @IsOptional() @IsIn(['azul', 'morado', 'rosa', 'naranja', 'verde', 'grafito']) acento?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) diasAvisoVencimiento?: number;

  /**
   * Fracción, no centavos: 0.80 es "avisa al 80 % del presupuesto". La columna
   * es `numeric(3,2)`, así que el rango útil es 0–0.99. Pasaba por el conversor
   * de centavos del cliente y llegaba truncada a 0, con lo que todo presupuesto
   * salía en ámbar desde el primer peso.
   */
  @IsOptional()
  @Matches(/^0(\.\d{1,2})?$|^1(\.0{1,2})?$/, {
    message: 'umbralPrecaucion debe estar entre 0 y 1',
  })
  umbralPrecaucion?: string;

  @IsOptional() @IsBoolean() notificacionesActivas?: boolean;
  @IsOptional() @IsBoolean() avisosCorreoVencimientos?: boolean;
  @IsOptional() @Matches(/^$|^\d{4}-\d{2}-\d{2}$/) ultimaRevisionVencimientos?: string;
}
