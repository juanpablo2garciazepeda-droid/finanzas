/**
 * Tipos del dominio.
 *
 * Dos convenciones que valen para todo el archivo:
 * - Los montos son enteros en centavos. $1,234.56 se guarda como 123456.
 * - Las fechas son texto `YYYY-MM-DD` y los periodos texto `YYYY-MM`.
 */

export type TipoMovimiento = 'ingreso' | 'egreso'

export type MetodoPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'

export type Periodicidad = 'semanal' | 'quincenal' | 'mensual' | 'unico'

export type NivelAlerta = 'verde' | 'ambar' | 'rojo'

/** Cada cuánto cobra la persona. Define la ventana del "¿puedo gastar?". */
export type TipoCiclo = 'mensual' | 'quincenal' | 'semanal'

export type Tema = 'claro' | 'oscuro' | 'sistema'

export type Acento = 'azul' | 'morado' | 'rosa' | 'naranja' | 'verde' | 'grafito'

export interface Categoria {
  id: string
  nombre: string
  tipo: TipoMovimiento
  /** Nombre del icono de lucide-react. */
  icono: string
  color: string
  esSistema: boolean
  archivada: boolean
  /** Orden de presentación. El id es un UUID y no sirve para ordenar. */
  orden: number
}

export interface Transaccion {
  id: string
  tipo: TipoMovimiento
  /** Centavos, siempre positivo. El signo lo da `tipo`. */
  monto: number
  categoriaId: string
  fecha: string
  metodoPago: MetodoPago
  nota: string
  creadoEn: string
}

export interface Presupuesto {
  id: string
  /** `null` significa presupuesto global del mes. */
  categoriaId: string | null
  montoLimite: number
  periodo: string
}

export interface Deuda {
  id: string
  acreedor: string
  montoOriginal: number
  /** Derivado de los pagos, materializado para no recalcularlo en cada render. */
  saldoActual: number
  /** Anual, en porcentaje. `null` si no aplica o no se conoce. */
  tasaInteres: number | null
  /** Próxima fecha de pago. */
  fechaLimite: string
  periodicidad: Periodicidad
  pagoMinimo: number
  liquidada: boolean
  creadoEn: string
}

export interface PagoDeuda {
  id: string
  deudaId: string
  monto: number
  fecha: string
  nota: string
}

export interface Meta {
  id: string
  nombre: string
  montoObjetivo: number
  /** Derivado de los aportes, materializado. */
  montoActual: number
  fechaLimite: string
  /** 1 es la más importante. */
  prioridad: number
  /** Lo que el usuario planea apartar cada mes. */
  aporteMensual: number
  icono: string
  completada: boolean
  creadoEn: string
}

export interface AporteMeta {
  id: string
  metaId: string
  monto: number
  fecha: string
  nota: string
}

export interface Ajustes {
  id: string
  moneda: string
  locale: string
  /**
   * Sueldo o ingreso fijo del mes, en centavos. Es la base con la que se
   * calcula el margen los días en que todavía no cae la nómina. Cero significa
   * "no configurado" y entonces se recurre al promedio histórico.
   */
  ingresoMensual: number
  /** Cada cuánto cobra. El margen y el semáforo se calculan sobre esta ventana. */
  cicloPago: TipoCiclo
  /**
   * Foto del dinero disponible: "el día X tenía esto en el banco". A partir de
   * ahí la app suma y resta lo registrado para saber cuánto hay ahora.
   */
  saldoInicial: number
  saldoInicialFecha: string
  tema: Tema
  acento: Acento
  /** Días de anticipación con los que un vencimiento cuenta como compromiso. */
  diasAvisoVencimiento: number
  /** Fracción del límite a partir de la cual el semáforo pasa a ámbar. */
  umbralPrecaucion: number
  notificacionesActivas: boolean
  ultimaRevisionVencimientos: string
}

/** Una razón concreta detrás de un veredicto del semáforo. */
export interface Razon {
  clave: string
  nivel: NivelAlerta
  texto: string
}

export interface Veredicto {
  nivel: NivelAlerta
  razones: Razon[]
  margenAntes: number
  margenDespues: number
}
