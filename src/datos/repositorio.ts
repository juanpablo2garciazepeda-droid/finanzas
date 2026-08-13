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
import { sumar } from '@/dominio/dinero'
import { aFechaLocal, aISO, hoyISO } from '@/dominio/fechas'
import { AJUSTES_INICIALES, ID_AJUSTES, ahora, db, nuevoId } from './db'
import { CATEGORIAS_INICIALES } from './categoriasIniciales'

/**
 * Único punto de escritura contra IndexedDB. La UI nunca toca `db` de forma
 * directa: así los saldos derivados (saldo de deuda, monto de meta) se
 * recalculan siempre dentro de la misma transacción que los provoca.
 */

// ─── Arranque ────────────────────────────────────────────────────────────────

export async function inicializar(): Promise<void> {
  await db.open()
  const ajustes = await db.ajustes.get(ID_AJUSTES)
  if (!ajustes) await db.ajustes.put(AJUSTES_INICIALES)

  const cuantas = await db.categorias.count()
  if (cuantas === 0) {
    await db.categorias.bulkAdd(
      CATEGORIAS_INICIALES.map((categoria, indice) => ({ ...categoria, id: nuevoId(), orden: indice })),
    )
  }
}

// ─── Ajustes ─────────────────────────────────────────────────────────────────

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  await db.ajustes.update(ID_AJUSTES, cambios)
}

// ─── Categorías ──────────────────────────────────────────────────────────────

export async function crearCategoria(
  datos: Omit<Categoria, 'id' | 'esSistema' | 'archivada' | 'orden'>,
): Promise<string> {
  const id = nuevoId()
  const orden = await db.categorias.count()
  await db.categorias.add({ ...datos, id, esSistema: false, archivada: false, orden })
  return id
}

export async function actualizarCategoria(id: string, cambios: Partial<Categoria>): Promise<void> {
  await db.categorias.update(id, cambios)
}

/**
 * Una categoría con movimientos no se borra, se archiva: borrarla dejaría
 * transacciones históricas apuntando a la nada.
 */
export async function eliminarCategoria(id: string): Promise<'eliminada' | 'archivada'> {
  const usos = await db.transacciones.where('categoriaId').equals(id).count()
  if (usos > 0) {
    await db.categorias.update(id, { archivada: true })
    return 'archivada'
  }
  await db.transacciones.where('categoriaId').equals(id).delete()
  await db.presupuestos.where('categoriaId').equals(id).delete()
  await db.categorias.delete(id)
  return 'eliminada'
}

// ─── Transacciones ───────────────────────────────────────────────────────────

export async function crearTransaccion(
  datos: Omit<Transaccion, 'id' | 'creadoEn'>,
): Promise<string> {
  const id = nuevoId()
  await db.transacciones.add({ ...datos, id, creadoEn: ahora() })
  return id
}

export async function actualizarTransaccion(id: string, cambios: Partial<Transaccion>): Promise<void> {
  await db.transacciones.update(id, cambios)
}

export async function eliminarTransaccion(id: string): Promise<void> {
  await db.transacciones.delete(id)
}

// ─── Presupuestos ────────────────────────────────────────────────────────────

/** Un solo presupuesto por categoría y periodo: definir dos sería ambiguo. */
export async function fijarPresupuesto(
  categoriaId: string | null,
  periodo: string,
  montoLimite: number,
): Promise<void> {
  const existentes = await db.presupuestos.where('periodo').equals(periodo).toArray()
  const previo = existentes.find((p) => p.categoriaId === categoriaId)

  if (montoLimite <= 0) {
    if (previo) await db.presupuestos.delete(previo.id)
    return
  }
  if (previo) {
    await db.presupuestos.update(previo.id, { montoLimite })
    return
  }
  await db.presupuestos.add({ id: nuevoId(), categoriaId, periodo, montoLimite })
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  await db.presupuestos.delete(id)
}

/** Copia los límites de un periodo al siguiente, sin pisar los ya definidos. */
export async function copiarPresupuestos(desde: string, hacia: string): Promise<number> {
  const origen = await db.presupuestos.where('periodo').equals(desde).toArray()
  const destino = await db.presupuestos.where('periodo').equals(hacia).toArray()
  const yaDefinidas = new Set(destino.map((p) => p.categoriaId))
  const nuevos = origen
    .filter((p) => !yaDefinidas.has(p.categoriaId))
    .map((p) => ({ id: nuevoId(), categoriaId: p.categoriaId, periodo: hacia, montoLimite: p.montoLimite }))
  if (nuevos.length > 0) await db.presupuestos.bulkAdd(nuevos)
  return nuevos.length
}

// ─── Deudas ──────────────────────────────────────────────────────────────────

export async function crearDeuda(
  datos: Omit<Deuda, 'id' | 'creadoEn' | 'saldoActual' | 'liquidada'> & { saldoActual?: number },
): Promise<string> {
  const id = nuevoId()
  await db.deudas.add({
    ...datos,
    id,
    saldoActual: datos.saldoActual ?? datos.montoOriginal,
    liquidada: false,
    creadoEn: ahora(),
  })
  return id
}

export async function actualizarDeuda(id: string, cambios: Partial<Deuda>): Promise<void> {
  await db.deudas.update(id, cambios)
  await recalcularDeuda(id)
}

export async function eliminarDeuda(id: string): Promise<void> {
  await db.transaction('rw', db.deudas, db.pagosDeuda, async () => {
    await db.pagosDeuda.where('deudaId').equals(id).delete()
    await db.deudas.delete(id)
  })
}

/**
 * El saldo es siempre `montoOriginal - pagos`. Se recalcula desde cero en cada
 * cambio para que un pago editado o borrado no deje el saldo desfasado.
 */
async function recalcularDeuda(deudaId: string): Promise<void> {
  const deuda = await db.deudas.get(deudaId)
  if (!deuda) return
  const pagos = await db.pagosDeuda.where('deudaId').equals(deudaId).toArray()
  const saldoActual = Math.max(0, deuda.montoOriginal - sumar(pagos.map((p) => p.monto)))
  await db.deudas.update(deudaId, { saldoActual, liquidada: saldoActual === 0 })
}

/** Adelanta la fecha de pago al siguiente ciclo tras registrar un abono. */
function avanzarVencimiento(deuda: Deuda): string {
  if (deuda.periodicidad === 'unico') return deuda.fechaLimite
  const fecha = aFechaLocal(deuda.fechaLimite)
  if (deuda.periodicidad === 'mensual') fecha.setMonth(fecha.getMonth() + 1)
  else if (deuda.periodicidad === 'quincenal') fecha.setDate(fecha.getDate() + 15)
  else fecha.setDate(fecha.getDate() + 7)
  return aISO(fecha)
}

export async function registrarPago(
  deudaId: string,
  monto: number,
  fecha: string,
  nota = '',
  avanzarFecha = true,
): Promise<void> {
  await db.transaction('rw', db.deudas, db.pagosDeuda, async () => {
    const deuda = await db.deudas.get(deudaId)
    if (!deuda) throw new Error('La deuda ya no existe')
    await db.pagosDeuda.add({ id: nuevoId(), deudaId, monto, fecha, nota })
    if (avanzarFecha) {
      await db.deudas.update(deudaId, { fechaLimite: avanzarVencimiento(deuda) })
    }
    await recalcularDeuda(deudaId)
  })
}

export async function eliminarPago(pagoId: string): Promise<void> {
  await db.transaction('rw', db.deudas, db.pagosDeuda, async () => {
    const pago = await db.pagosDeuda.get(pagoId)
    if (!pago) return
    await db.pagosDeuda.delete(pagoId)
    await recalcularDeuda(pago.deudaId)
  })
}

// ─── Metas ───────────────────────────────────────────────────────────────────

export async function crearMeta(
  datos: Omit<Meta, 'id' | 'creadoEn' | 'montoActual' | 'completada'> & { montoActual?: number },
): Promise<string> {
  const id = nuevoId()
  const montoActual = datos.montoActual ?? 0
  await db.transaction('rw', db.metas, db.aportesMeta, async () => {
    await db.metas.add({
      ...datos,
      id,
      montoActual: 0,
      completada: false,
      creadoEn: ahora(),
    })
    // El ahorro inicial entra como primer aporte para que aparezca en el
    // historial en vez de salir de la nada.
    if (montoActual > 0) {
      await db.aportesMeta.add({
        id: nuevoId(),
        metaId: id,
        monto: montoActual,
        fecha: hoyISO(),
        nota: 'Saldo inicial',
      })
    }
    await recalcularMeta(id)
  })
  return id
}

export async function actualizarMeta(id: string, cambios: Partial<Meta>): Promise<void> {
  await db.metas.update(id, cambios)
  await recalcularMeta(id)
}

export async function eliminarMeta(id: string): Promise<void> {
  await db.transaction('rw', db.metas, db.aportesMeta, async () => {
    await db.aportesMeta.where('metaId').equals(id).delete()
    await db.metas.delete(id)
  })
}

async function recalcularMeta(metaId: string): Promise<void> {
  const meta = await db.metas.get(metaId)
  if (!meta) return
  const aportes = await db.aportesMeta.where('metaId').equals(metaId).toArray()
  const montoActual = Math.max(0, sumar(aportes.map((a) => a.monto)))
  await db.metas.update(metaId, { montoActual, completada: montoActual >= meta.montoObjetivo })
}

export async function registrarAporte(
  metaId: string,
  monto: number,
  fecha: string,
  nota = '',
): Promise<void> {
  await db.transaction('rw', db.metas, db.aportesMeta, async () => {
    await db.aportesMeta.add({ id: nuevoId(), metaId, monto, fecha, nota })
    await recalcularMeta(metaId)
  })
}

export async function eliminarAporte(aporteId: string): Promise<void> {
  await db.transaction('rw', db.metas, db.aportesMeta, async () => {
    const aporte = await db.aportesMeta.get(aporteId)
    if (!aporte) return
    await db.aportesMeta.delete(aporteId)
    await recalcularMeta(aporte.metaId)
  })
}

export async function reordenarMetas(idsEnOrden: string[]): Promise<void> {
  await db.transaction('rw', db.metas, async () => {
    for (const [indice, id] of idsEnOrden.entries()) {
      await db.metas.update(id, { prioridad: indice + 1 })
    }
  })
}

// ─── Mantenimiento ───────────────────────────────────────────────────────────

export interface Respaldo {
  version: number
  generado: string
  categorias: Categoria[]
  transacciones: Transaccion[]
  presupuestos: Presupuesto[]
  deudas: Deuda[]
  pagosDeuda: PagoDeuda[]
  metas: Meta[]
  aportesMeta: AporteMeta[]
  ajustes: Ajustes[]
}

export async function exportarRespaldo(): Promise<Respaldo> {
  const [categorias, transacciones, presupuestos, deudas, pagosDeuda, metas, aportesMeta, ajustes] =
    await Promise.all([
      db.categorias.toArray(),
      db.transacciones.toArray(),
      db.presupuestos.toArray(),
      db.deudas.toArray(),
      db.pagosDeuda.toArray(),
      db.metas.toArray(),
      db.aportesMeta.toArray(),
      db.ajustes.toArray(),
    ])
  return {
    version: 1,
    generado: ahora(),
    categorias,
    transacciones,
    presupuestos,
    deudas,
    pagosDeuda,
    metas,
    aportesMeta,
    ajustes,
  }
}

/** Reemplaza todo el contenido. Se aborta entero si algo falla a medio camino. */
export async function importarRespaldo(respaldo: Respaldo): Promise<void> {
  if (respaldo.version !== 1) throw new Error('El respaldo es de una versión que esta app no reconoce')
  await db.transaction(
    'rw',
    [db.categorias, db.transacciones, db.presupuestos, db.deudas, db.pagosDeuda, db.metas, db.aportesMeta, db.ajustes],
    async () => {
      await Promise.all([
        db.categorias.clear(),
        db.transacciones.clear(),
        db.presupuestos.clear(),
        db.deudas.clear(),
        db.pagosDeuda.clear(),
        db.metas.clear(),
        db.aportesMeta.clear(),
        db.ajustes.clear(),
      ])
      await Promise.all([
        db.categorias.bulkAdd(respaldo.categorias),
        db.transacciones.bulkAdd(respaldo.transacciones),
        db.presupuestos.bulkAdd(respaldo.presupuestos),
        db.deudas.bulkAdd(respaldo.deudas),
        db.pagosDeuda.bulkAdd(respaldo.pagosDeuda),
        db.metas.bulkAdd(respaldo.metas),
        db.aportesMeta.bulkAdd(respaldo.aportesMeta),
        db.ajustes.bulkAdd(respaldo.ajustes),
      ])
    },
  )
}

/** Deja la app como recién instalada, con las categorías iniciales. */
export async function borrarTodo(): Promise<void> {
  await db.delete()
  await db.open()
  await inicializar()
}
