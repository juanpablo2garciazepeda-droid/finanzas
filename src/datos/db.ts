import Dexie, { type Table } from 'dexie'
import type {
  Ajustes,
  AporteMeta,
  Categoria,
  Deuda,
  Meta,
  PagoDeuda,
  Presupuesto,
  Transaccion,
} from '@/dominio/tipos'

/**
 * IndexedDB vía Dexie. Todo vive en este dispositivo: no hay servidor y nada
 * sale del navegador.
 *
 * Se usa el patrón de aserción en vez de una subclase porque, con
 * `useDefineForClassFields` activo, los campos declarados en una subclase de
 * Dexie se reinicializan a `undefined` y borran las tablas que el constructor
 * acaba de asignar.
 */
export const db = new Dexie('finanzas') as Dexie & {
  categorias: Table<Categoria, string>
  transacciones: Table<Transaccion, string>
  presupuestos: Table<Presupuesto, string>
  deudas: Table<Deuda, string>
  pagosDeuda: Table<PagoDeuda, string>
  metas: Table<Meta, string>
  aportesMeta: Table<AporteMeta, string>
  ajustes: Table<Ajustes, string>
}

db.version(1).stores({
  categorias: 'id, tipo, archivada',
  transacciones: 'id, fecha, categoriaId, tipo',
  presupuestos: 'id, periodo, categoriaId',
  deudas: 'id, liquidada, fechaLimite',
  pagosDeuda: 'id, deudaId, fecha',
  metas: 'id, completada, fechaLimite, prioridad',
  aportesMeta: 'id, metaId, fecha',
  ajustes: 'id',
})

// v2: las categorías necesitan un orden propio; el id es un UUID y ordenar por
// él deja el selector del formulario barajado en cada instalación.
db.version(2)
  .stores({ categorias: 'id, tipo, archivada, orden' })
  .upgrade((tx) =>
    tx
      .table<Categoria>('categorias')
      .toCollection()
      .modify((categoria, referencia) => {
        referencia.value.orden = categoria.orden ?? 0
      }),
  )

// v3: sueldo mensual configurable. Sin él, los primeros días del mes el margen
// se calcula sobre cero ingresos y todo sale en rojo.
db.version(3).upgrade((tx) =>
  tx
    .table<Ajustes>('ajustes')
    .toCollection()
    .modify((ajustes, referencia) => {
      referencia.value.ingresoMensual = ajustes.ingresoMensual ?? 0
    }),
)

// v4: ciclo de cobro y apariencia.
db.version(4).upgrade((tx) =>
  tx
    .table<Ajustes>('ajustes')
    .toCollection()
    .modify((ajustes, referencia) => {
      referencia.value.cicloPago = ajustes.cicloPago ?? 'quincenal'
      referencia.value.tema = ajustes.tema ?? 'sistema'
      referencia.value.acento = ajustes.acento ?? 'azul'
    }),
)

// v5: saldo declarado. Sin él la app solo razona sobre flujos y no puede
// responder a "¿cuánto dinero tengo ahora?".
db.version(5).upgrade((tx) =>
  tx
    .table<Ajustes>('ajustes')
    .toCollection()
    .modify((ajustes, referencia) => {
      referencia.value.saldoInicial = ajustes.saldoInicial ?? 0
      referencia.value.saldoInicialFecha = ajustes.saldoInicialFecha ?? ''
    }),
)

export const ID_AJUSTES = 'unico'

export function nuevoId(): string {
  return crypto.randomUUID()
}

export function ahora(): string {
  return new Date().toISOString()
}

export const AJUSTES_INICIALES: Ajustes = {
  id: ID_AJUSTES,
  moneda: 'MXN',
  locale: 'es-MX',
  ingresoMensual: 0,
  cicloPago: 'quincenal',
  saldoInicial: 0,
  saldoInicialFecha: '',
  tema: 'sistema',
  acento: 'azul',
  diasAvisoVencimiento: 7,
  umbralPrecaucion: 0.8,
  notificacionesActivas: false,
  ultimaRevisionVencimientos: '',
}
