/** Constructores de datos para las pruebas del dominio. */
import type { ContextoFinanciero } from './alertas'
import type {
  Ajustes,
  AporteMeta,
  Categoria,
  Deuda,
  Meta,
  PagoDeuda,
  Presupuesto,
  Transaccion,
} from './tipos'

export const AJUSTES: Ajustes = {
  id: 'unico',
  moneda: 'MXN',
  locale: 'es-MX',
  ingresoMensual: 0,
  // Los tests del margen se escribieron sobre meses completos; el ciclo
  // quincenal tiene su propio bloque de pruebas.
  cicloPago: 'mensual',
  saldoInicial: 0,
  saldoInicialFecha: '',
  tema: 'sistema',
  acento: 'azul',
  diasAvisoVencimiento: 7,
  umbralPrecaucion: 0.8,
  notificacionesActivas: false,
  ultimaRevisionVencimientos: '',
}

export const CATEGORIAS: Categoria[] = [
  { id: 'comida', nombre: 'Comida', tipo: 'egreso', icono: 'Utensils', color: '#BC670D', esSistema: true, archivada: false, orden: 0 },
  { id: 'renta', nombre: 'Renta', tipo: 'egreso', icono: 'House', color: '#7968EB', esSistema: true, archivada: false, orden: 1 },
  { id: 'sueldo', nombre: 'Sueldo', tipo: 'ingreso', icono: 'Briefcase', color: '#10924B', esSistema: true, archivada: false, orden: 2 },
]

let contador = 0
function id(): string {
  contador++
  return `id-${contador}`
}

export function transaccion(parcial: Partial<Transaccion> = {}): Transaccion {
  return {
    id: id(),
    tipo: 'egreso',
    monto: 10_000,
    categoriaId: 'comida',
    fecha: '2026-08-05',
    metodoPago: 'debito',
    nota: '',
    creadoEn: '2026-08-05T12:00:00.000Z',
    ...parcial,
  }
}

export function presupuesto(parcial: Partial<Presupuesto> = {}): Presupuesto {
  return { id: id(), categoriaId: 'comida', montoLimite: 500_000, periodo: '2026-08', ...parcial }
}

export function deuda(parcial: Partial<Deuda> = {}): Deuda {
  return {
    id: id(),
    acreedor: 'Banco',
    montoOriginal: 1_000_000,
    saldoActual: 1_000_000,
    tasaInteres: null,
    fechaLimite: '2026-08-20',
    periodicidad: 'mensual',
    pagoMinimo: 100_000,
    liquidada: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...parcial,
  }
}

export function pago(parcial: Partial<PagoDeuda> = {}): PagoDeuda {
  return { id: id(), deudaId: 'deuda-1', monto: 100_000, fecha: '2026-08-01', nota: '', ...parcial }
}

export function meta(parcial: Partial<Meta> = {}): Meta {
  return {
    id: id(),
    nombre: 'Fondo de emergencia',
    montoObjetivo: 3_000_000,
    montoActual: 0,
    fechaLimite: '2027-08-01',
    prioridad: 1,
    aporteMensual: 200_000,
    icono: 'Shield',
    completada: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...parcial,
  }
}

export function aporte(parcial: Partial<AporteMeta> = {}): AporteMeta {
  return { id: id(), metaId: 'meta-1', monto: 200_000, fecha: '2026-08-01', nota: '', ...parcial }
}

export function contexto(parcial: Partial<ContextoFinanciero> = {}): ContextoFinanciero {
  return {
    hoy: '2026-08-13',
    periodo: '2026-08',
    ajustes: AJUSTES,
    categorias: CATEGORIAS,
    transacciones: [],
    presupuestos: [],
    deudas: [],
    pagos: [],
    metas: [],
    aportes: [],
    ...parcial,
  }
}
