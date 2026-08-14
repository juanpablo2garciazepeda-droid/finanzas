/**
 * Capa de datos. Antes escribía contra IndexedDB; ahora habla con el backend
 * NestJS. Las firmas se conservan para que las páginas y los hooks de la UI
 * sigan funcionando sin tocarse.
 *
 * Convenciones:
 * - El backend serializa bigint como string (precisión). El dominio espera
 *   `number` en centavos. Convertimos en cada borde.
 * - `Ajustes` en el backend no tiene `id` (la PK es `userId`); el dominio
 *   espera un `id: 'unico'` para encajar con la UI. Lo añadimos al recibir.
 * - `Categoria` en el backend tiene `creadoEn` y `actualizadoEn` (timestamps
 *   que el dominio no usa) — los conservamos por completitud pero no se
 *   exponen en los tipos de UI.
 */

import type {
  Ajustes,
  AporteMeta,
  Categoria,
  Deuda,
  GastoRecurrente,
  Meta,
  PagoDeuda,
  Presupuesto,
  Transaccion,
} from '@/dominio/tipos'
import { API_URL as API_URL_BACK, api, obtenerToken as obtenerTokenLocal } from '@/api/cliente'

// ─── Conversores bigint ─────────────────────────────────────────────────────

/** Convierte string|null (lo que devuelve PG para bigint) en number. */
function aNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0
  return typeof valor === 'number' ? valor : Number(valor)
}

/** Convierte number a string para que PG acepte el bigint. */
function aStringBigInt(valor: number): string {
  return String(Math.trunc(valor))
}

// ─── Forma de las respuestas de la API ──────────────────────────────────────

interface ApiAjustes {
  userId: string
  moneda: string
  locale: string
  ingresoMensual: string | number
  cicloPago: 'mensual' | 'quincenal' | 'semanal'
  saldoInicial: string | number
  saldoInicialFecha: string
  tema: 'claro' | 'oscuro' | 'sistema'
  acento: string
  diasAvisoVencimiento: number
  umbralPrecaucion: string | number
  notificacionesActivas: boolean
  ultimaRevisionVencimientos: string
  actualizadoEn?: string
}

interface ApiCategoria {
  id: string
  userId: string
  nombre: string
  tipo: 'ingreso' | 'egreso'
  icono: string
  color: string
  esSistema: boolean
  archivada: boolean
  orden: number
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiTransaccion {
  id: string
  userId: string
  tipo: 'ingreso' | 'egreso'
  monto: string | number
  categoriaId: string
  fecha: string
  metodoPago: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'
  nota: string
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiPresupuesto {
  id: string
  userId: string
  categoriaId: string | null
  montoLimite: string | number
  periodo: string
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiDeuda {
  id: string
  userId: string
  acreedor: string
  montoOriginal: string | number
  saldoActual: string | number
  tasaInteres: string | number | null
  fechaLimite: string
  periodicidad: 'semanal' | 'quincenal' | 'mensual' | 'unico'
  pagoMinimo: string | number
  liquidada: boolean
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiPagoDeuda {
  id: string
  userId: string
  deudaId: string
  monto: string | number
  fecha: string
  nota: string
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiMeta {
  id: string
  userId: string
  nombre: string
  montoObjetivo: string | number
  montoActual: string | number
  fechaLimite: string
  prioridad: number
  aporteMensual: string | number
  icono: string
  completada: boolean
  creadoEn?: string
  actualizadoEn?: string
}

interface ApiAporteMeta {
  id: string
  userId: string
  metaId: string
  monto: string | number
  fecha: string
  nota: string
  creadoEn?: string
  actualizadoEn?: string
}

// ─── Mapeadores ────────────────────────────────────────────────────────────

function ajusteDesdeApi(a: ApiAjustes): Ajustes {
  return {
    id: 'unico',
    moneda: a.moneda,
    locale: a.locale,
    ingresoMensual: aNumero(a.ingresoMensual),
    cicloPago: a.cicloPago,
    saldoInicial: aNumero(a.saldoInicial),
    saldoInicialFecha: a.saldoInicialFecha,
    tema: a.tema,
    acento: a.acento as Ajustes['acento'],
    diasAvisoVencimiento: a.diasAvisoVencimiento,
    umbralPrecaucion: aNumero(a.umbralPrecaucion),
    notificacionesActivas: a.notificacionesActivas,
    ultimaRevisionVencimientos: a.ultimaRevisionVencimientos,
  }
}

function ajusteHaciaApi(cambios: Partial<Ajustes>): Partial<ApiAjustes> {
  const out: Partial<ApiAjustes> = {}
  if (cambios.moneda !== undefined) out.moneda = cambios.moneda
  if (cambios.locale !== undefined) out.locale = cambios.locale
  if (cambios.ingresoMensual !== undefined) out.ingresoMensual = aStringBigInt(cambios.ingresoMensual)
  if (cambios.cicloPago !== undefined) out.cicloPago = cambios.cicloPago
  if (cambios.saldoInicial !== undefined) out.saldoInicial = aStringBigInt(cambios.saldoInicial)
  if (cambios.saldoInicialFecha !== undefined) out.saldoInicialFecha = cambios.saldoInicialFecha
  if (cambios.tema !== undefined) out.tema = cambios.tema
  if (cambios.acento !== undefined) out.acento = cambios.acento
  if (cambios.diasAvisoVencimiento !== undefined) out.diasAvisoVencimiento = cambios.diasAvisoVencimiento
  // NO pasa por aStringBigInt: es una fracción (0.8), no centavos. La columna
  // es numeric(3,2) y truncar a entero la dejaba en 0, con lo que cualquier
  // presupuesto con un solo peso gastado ya salía en ámbar. Va como cadena
  // igual que los bigint, que es lo que espera el DTO del backend.
  if (cambios.umbralPrecaucion !== undefined) {
    out.umbralPrecaucion = cambios.umbralPrecaucion.toFixed(2)
  }
  if (cambios.notificacionesActivas !== undefined) out.notificacionesActivas = cambios.notificacionesActivas
  if (cambios.ultimaRevisionVencimientos !== undefined) {
    out.ultimaRevisionVencimientos = cambios.ultimaRevisionVencimientos
  }
  return out
}

function categoriaDesdeApi(c: ApiCategoria): Categoria {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    icono: c.icono,
    color: c.color,
    esSistema: c.esSistema,
    archivada: c.archivada,
    orden: c.orden,
  }
}

function transaccionDesdeApi(t: ApiTransaccion): Transaccion {
  return {
    id: t.id,
    tipo: t.tipo,
    monto: aNumero(t.monto),
    categoriaId: t.categoriaId,
    fecha: t.fecha,
    metodoPago: t.metodoPago,
    nota: t.nota,
    creadoEn: t.creadoEn ?? t.actualizadoEn ?? '',
  }
}

function transaccionHaciaApi(t: Partial<Transaccion>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (t.tipo !== undefined) out.tipo = t.tipo
  if (t.monto !== undefined) out.monto = aStringBigInt(t.monto)
  if (t.categoriaId !== undefined) out.categoriaId = t.categoriaId
  if (t.fecha !== undefined) out.fecha = t.fecha
  if (t.metodoPago !== undefined) out.metodoPago = t.metodoPago
  if (t.nota !== undefined) out.nota = t.nota
  return out
}

function presupuestoDesdeApi(p: ApiPresupuesto): Presupuesto {
  return {
    id: p.id,
    categoriaId: p.categoriaId,
    montoLimite: aNumero(p.montoLimite),
    periodo: p.periodo,
  }
}

function deudaDesdeApi(d: ApiDeuda): Deuda {
  return {
    id: d.id,
    acreedor: d.acreedor,
    montoOriginal: aNumero(d.montoOriginal),
    saldoActual: aNumero(d.saldoActual),
    tasaInteres: d.tasaInteres === null ? null : aNumero(d.tasaInteres),
    fechaLimite: d.fechaLimite,
    periodicidad: d.periodicidad,
    pagoMinimo: aNumero(d.pagoMinimo),
    liquidada: d.liquidada,
    creadoEn: d.creadoEn ?? d.actualizadoEn ?? '',
  }
}

function deudaHaciaApi(d: Partial<Deuda>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (d.acreedor !== undefined) out.acreedor = d.acreedor
  if (d.montoOriginal !== undefined) out.montoOriginal = aStringBigInt(d.montoOriginal)
  if (d.saldoActual !== undefined) out.saldoActual = aStringBigInt(d.saldoActual)
  if (d.tasaInteres !== undefined) out.tasaInteres = d.tasaInteres === null ? null : aStringBigInt(d.tasaInteres)
  if (d.fechaLimite !== undefined) out.fechaLimite = d.fechaLimite
  if (d.periodicidad !== undefined) out.periodicidad = d.periodicidad
  if (d.pagoMinimo !== undefined) out.pagoMinimo = aStringBigInt(d.pagoMinimo)
  if (d.liquidada !== undefined) out.liquidada = d.liquidada
  return out
}

function pagoDesdeApi(p: ApiPagoDeuda): PagoDeuda {
  return {
    id: p.id,
    deudaId: p.deudaId,
    monto: aNumero(p.monto),
    fecha: p.fecha,
    nota: p.nota,
  }
}

function metaDesdeApi(m: ApiMeta): Meta {
  return {
    id: m.id,
    nombre: m.nombre,
    montoObjetivo: aNumero(m.montoObjetivo),
    montoActual: aNumero(m.montoActual),
    fechaLimite: m.fechaLimite,
    prioridad: m.prioridad,
    aporteMensual: aNumero(m.aporteMensual),
    icono: m.icono,
    completada: m.completada,
    creadoEn: m.creadoEn ?? m.actualizadoEn ?? '',
  }
}

function metaHaciaApi(m: Partial<Meta>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (m.nombre !== undefined) out.nombre = m.nombre
  if (m.montoObjetivo !== undefined) out.montoObjetivo = aStringBigInt(m.montoObjetivo)
  if (m.montoActual !== undefined) out.montoActual = aStringBigInt(m.montoActual)
  if (m.fechaLimite !== undefined) out.fechaLimite = m.fechaLimite
  if (m.prioridad !== undefined) out.prioridad = m.prioridad
  if (m.aporteMensual !== undefined) out.aporteMensual = aStringBigInt(m.aporteMensual)
  if (m.icono !== undefined) out.icono = m.icono
  if (m.completada !== undefined) out.completada = m.completada
  return out
}

function aporteDesdeApi(a: ApiAporteMeta): AporteMeta {
  return {
    id: a.id,
    metaId: a.metaId,
    monto: aNumero(a.monto),
    fecha: a.fecha,
    nota: a.nota,
  }
}

// ─── Lecturas masivas (las usa el ProveedorFinanzas) ───────────────────────

export async function cargarTodo(): Promise<{
  ajustes: Ajustes
  categorias: Categoria[]
  transacciones: Transaccion[]
  presupuestos: Presupuesto[]
  deudas: Deuda[]
  pagos: PagoDeuda[]
  metas: Meta[]
  aportes: AporteMeta[]
}> {
  // Un solo round-trip al backend; el servidor reparaleliza las queries.
  // Antes eran 6 + N_deudas + N_metas (~11 con 3 deudas y 2 metas), y eso en
  // un foco de pestaña se notaba.
  const res = await api.get<{
    ajustes: ApiAjustes
    categorias: ApiCategoria[]
    transacciones: ApiTransaccion[]
    presupuestos: ApiPresupuesto[]
    deudas: ApiDeuda[]
    metas: ApiMeta[]
    pagos: ApiPagoDeuda[]
    aportes: ApiAporteMeta[]
  }>('/inicio')

  if (!res.ok || !res.data) {
    return {
      ajustes: ajustesPorDefecto(),
      categorias: [],
      transacciones: [],
      presupuestos: [],
      deudas: [],
      pagos: [],
      metas: [],
      aportes: [],
    }
  }

  const d = res.data
  return {
    ajustes: ajusteDesdeApi(d.ajustes),
    categorias: d.categorias.map(categoriaDesdeApi),
    transacciones: d.transacciones.map(transaccionDesdeApi),
    presupuestos: d.presupuestos.map(presupuestoDesdeApi),
    deudas: d.deudas.map(deudaDesdeApi),
    pagos: d.pagos.map(pagoDesdeApi),
    metas: d.metas.map(metaDesdeApi),
    aportes: d.aportes.map(aporteDesdeApi),
  }
}

function ajustesPorDefecto(): Ajustes {
  return {
    id: 'unico',
    moneda: 'MXN',
    locale: 'es-MX',
    ingresoMensual: 0,
    cicloPago: 'quincenal',
    saldoInicial: 0,
    saldoInicialFecha: '',
    tema: 'sistema',
    acento: 'grafito',
    diasAvisoVencimiento: 7,
    umbralPrecaucion: 0.8,
    notificacionesActivas: false,
    ultimaRevisionVencimientos: '',
  }
}

// ─── Ajustes ───────────────────────────────────────────────────────────────

/**
 * Devuelve los ajustes nuevos del backend para que el caller actualice
 * el estado local sin tener que hacer un refetch entero. Esto es
 * importante para cosas como `tema` y `acento` que se aplican al DOM
 * en un `useEffect`: si la UI no se actualiza, el `useEffect` no
 * corre y el cambio solo se ve al recargar.
 */
export async function guardarAjustes(
  cambios: Partial<Ajustes>,
): Promise<Ajustes> {
  const res = await api.patch<ApiAjustes>('/ajustes', ajusteHaciaApi(cambios))
  if (!res.ok || !res.data) {
    throw new Error(res.error ?? 'No se pudieron guardar los ajustes')
  }
  return ajusteDesdeApi(res.data)
}

// ─── Categorías ────────────────────────────────────────────────────────────

export async function crearCategoria(
  datos: Omit<Categoria, 'id' | 'esSistema' | 'archivada' | 'orden'>,
): Promise<string> {
  const res = await api.post<ApiCategoria>('/categorias', {
    nombre: datos.nombre,
    tipo: datos.tipo,
    icono: datos.icono,
    color: datos.color,
    esSistema: false,
    archivada: false,
  })
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo crear la categoría')
  return res.data.id
}

export async function actualizarCategoria(id: string, cambios: Partial<Categoria>): Promise<void> {
  await api.patch(`/categorias/${id}`, cambios)
}

/** En el backend el borrado es duro. La lógica de "archivar si tiene uso" se
 *  mueve al frontend: primero preguntamos, después decidimos. */
export async function eliminarCategoria(id: string): Promise<'eliminada' | 'archivada'> {
  // Traemos todas las transacciones del usuario para contar usos. El backend
  // aún no expone un endpoint con ?categoriaId, pero son pocas filas.
  const lista = await api.get<ApiTransaccion[]>('/transacciones')
  const usos = lista.ok && lista.data ? lista.data.filter((t) => t.categoriaId === id).length : 0
  if (usos > 0) {
    await api.patch(`/categorias/${id}`, { archivada: true })
    return 'archivada'
  }
  await api.delete(`/categorias/${id}`)
  return 'eliminada'
}

// ─── Transacciones ─────────────────────────────────────────────────────────

export async function crearTransaccion(
  datos: Omit<Transaccion, 'id' | 'creadoEn'>,
): Promise<string> {
  const res = await api.post<ApiTransaccion>('/transacciones', transaccionHaciaApi(datos))
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo crear la transacción')
  return res.data.id
}

export async function actualizarTransaccion(id: string, cambios: Partial<Transaccion>): Promise<void> {
  await api.patch(`/transacciones/${id}`, transaccionHaciaApi(cambios))
}

export async function eliminarTransaccion(id: string): Promise<void> {
  await api.delete(`/transacciones/${id}`)
}

// ─── Presupuestos ──────────────────────────────────────────────────────────

export async function fijarPresupuesto(
  categoriaId: string | null,
  periodo: string,
  montoLimite: number,
): Promise<void> {
  // El backend ya filtra por query string: ?periodo=YYYY-MM.
  const lista = await api.get<ApiPresupuesto[]>(`/presupuestos?periodo=${periodo}`)
  const existente =
    lista.ok && lista.data
      ? lista.data.find((p) => p.categoriaId === categoriaId)
      : undefined

  if (montoLimite <= 0) {
    if (existente) await api.delete(`/presupuestos/${existente.id}`)
    return
  }
  if (existente) {
    await api.patch(`/presupuestos/${existente.id}`, { montoLimite: aStringBigInt(montoLimite) })
    return
  }
  await api.post('/presupuestos', {
    categoriaId,
    periodo,
    montoLimite: aStringBigInt(montoLimite),
  })
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  await api.delete(`/presupuestos/${id}`)
}

export async function copiarPresupuestos(desde: string, hacia: string): Promise<number> {
  const [origen, destino] = await Promise.all([
    api.get<ApiPresupuesto[]>(`/presupuestos?periodo=${desde}`),
    api.get<ApiPresupuesto[]>(`/presupuestos?periodo=${hacia}`),
  ])
  if (!origen.ok || !origen.data) return 0
  const yaDefinidas = new Set(
    destino.ok && destino.data ? destino.data.map((p) => p.categoriaId) : [],
  )
  const nuevos = origen.data.filter((p) => !yaDefinidas.has(p.categoriaId))
  for (const p of nuevos) {
    await api.post('/presupuestos', {
      categoriaId: p.categoriaId,
      periodo: hacia,
      montoLimite: aStringBigInt(aNumero(p.montoLimite)),
    })
  }
  return nuevos.length
}

// ─── Deudas ────────────────────────────────────────────────────────────────

export async function crearDeuda(
  datos: Omit<Deuda, 'id' | 'creadoEn' | 'saldoActual' | 'liquidada'> & {
    saldoActual?: number
  },
): Promise<string> {
  const saldoInicial = datos.saldoActual ?? datos.montoOriginal
  const res = await api.post<ApiDeuda>('/deudas', {
    ...deudaHaciaApi(datos),
    saldoActual: aStringBigInt(saldoInicial),
    liquidada: false,
  })
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo crear la deuda')
  return res.data.id
}

export async function actualizarDeuda(id: string, cambios: Partial<Deuda>): Promise<void> {
  await api.patch(`/deudas/${id}`, deudaHaciaApi(cambios))
}

export async function eliminarDeuda(id: string): Promise<void> {
  await api.delete(`/deudas/${id}`)
}

export async function registrarPago(
  deudaId: string,
  monto: number,
  fecha: string,
  nota = '',
): Promise<void> {
  await api.post(`/deudas/${deudaId}/pagos`, {
    monto: aStringBigInt(monto),
    fecha,
    nota,
  })
}

export async function eliminarPago(pagoId: string): Promise<void> {
  await api.delete(`/deudas/pagos/${pagoId}`)
}

// ─── Metas ─────────────────────────────────────────────────────────────────

export async function crearMeta(
  datos: Omit<Meta, 'id' | 'creadoEn' | 'montoActual' | 'completada'> & {
    montoActual?: number
  },
): Promise<string> {
  const montoInicial = datos.montoActual ?? 0
  // Primero creamos la meta en cero; luego, si hay ahorro inicial, registramos
  // un aporte (el backend lo acumula en montoActual y marca completada).
  const res = await api.post<ApiMeta>('/metas', {
    ...metaHaciaApi(datos),
    montoActual: '0',
    completada: false,
  })
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo crear la meta')
  if (montoInicial > 0) {
    await api.post(`/metas/${res.data.id}/aportes`, {
      monto: aStringBigInt(montoInicial),
      fecha: new Date().toISOString().slice(0, 10),
      nota: 'Saldo inicial',
    })
  }
  return res.data.id
}

export async function actualizarMeta(id: string, cambios: Partial<Meta>): Promise<void> {
  await api.patch(`/metas/${id}`, metaHaciaApi(cambios))
}

export async function eliminarMeta(id: string): Promise<void> {
  await api.delete(`/metas/${id}`)
}

export async function registrarAporte(
  metaId: string,
  monto: number,
  fecha: string,
  nota = '',
): Promise<void> {
  await api.post(`/metas/${metaId}/aportes`, {
    monto: aStringBigInt(monto),
    fecha,
    nota,
  })
}

export async function eliminarAporte(aporteId: string): Promise<void> {
  await api.delete(`/metas/aportes/${aporteId}`)
}

export async function reordenarMetas(idsEnOrden: string[]): Promise<void> {
  // El backend no tiene un endpoint batch de reorden. Vamos uno por uno
  // actualizando `prioridad`. En la práctica se reordena arrastrando y son
  // pocas metas, así que no es un problema de rendimiento.
  for (const [indice, id] of idsEnOrden.entries()) {
    await api.patch(`/metas/${id}`, { prioridad: indice + 1 })
  }
}

// ─── Recurrentes ──────────────────────────────────────────────────────────

interface ApiRecurrente {
  id: string
  userId: string
  tipo: 'ingreso' | 'egreso'
  monto: string | number
  categoriaId: string
  metodoPago: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'
  nota: string
  diaDelMes: number
  iniciaEn: string
  terminaEn: string | null
  activo: boolean
  ultimoGeneradoEn: string | null
}

function recurrenteDeApi(r: ApiRecurrente): GastoRecurrente {
  return {
    id: r.id,
    tipo: r.tipo,
    monto: aNumero(r.monto),
    categoriaId: r.categoriaId,
    metodoPago: r.metodoPago,
    nota: r.nota,
    diaDelMes: r.diaDelMes,
    iniciaEn: r.iniciaEn,
    terminaEn: r.terminaEn,
    activo: r.activo,
    ultimoGeneradoEn: r.ultimoGeneradoEn,
  }
}

export async function listarRecurrentes(): Promise<GastoRecurrente[]> {
  const res = await api.get<ApiRecurrente[]>('/recurrentes')
  if (!res.ok || !res.data) return []
  return res.data.map(recurrenteDeApi)
}

export async function crearRecurrente(input: Omit<GastoRecurrente, 'id' | 'ultimoGeneradoEn'>): Promise<GastoRecurrente> {
  const res = await api.post<ApiRecurrente>('/recurrentes', {
    tipo: input.tipo,
    monto: aStringBigInt(input.monto),
    categoriaId: input.categoriaId,
    metodoPago: input.metodoPago,
    nota: input.nota,
    diaDelMes: input.diaDelMes,
    iniciaEn: input.iniciaEn,
    terminaEn: input.terminaEn,
    activo: input.activo,
  })
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo crear el recurrente')
  return recurrenteDeApi(res.data)
}

export async function actualizarRecurrente(
  id: string,
  input: Partial<Omit<GastoRecurrente, 'id'>>,
): Promise<GastoRecurrente> {
  const cuerpo: Record<string, unknown> = {}
  if (input.tipo !== undefined) cuerpo.tipo = input.tipo
  if (input.monto !== undefined) cuerpo.monto = aStringBigInt(input.monto)
  if (input.categoriaId !== undefined) cuerpo.categoriaId = input.categoriaId
  if (input.metodoPago !== undefined) cuerpo.metodoPago = input.metodoPago
  if (input.nota !== undefined) cuerpo.nota = input.nota
  if (input.diaDelMes !== undefined) cuerpo.diaDelMes = input.diaDelMes
  if (input.iniciaEn !== undefined) cuerpo.iniciaEn = input.iniciaEn
  if (input.terminaEn !== undefined) cuerpo.terminaEn = input.terminaEn
  if (input.activo !== undefined) cuerpo.activo = input.activo
  const res = await api.patch<ApiRecurrente>(`/recurrentes/${id}`, cuerpo)
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo actualizar')
  return recurrenteDeApi(res.data)
}

export async function eliminarRecurrente(id: string): Promise<void> {
  await api.delete(`/recurrentes/${id}`)
}

// ─── Importar / Exportar mis datos ─────────────────────────────────────────

export interface ExportarDatos {
  generadoEn: string
  usuario: { email: string; displayName: string; idioma: string; creadoEn: string }
  categorias: unknown[]
  transacciones: unknown[]
  presupuestos: unknown[]
  deudas: unknown[]
  pagos: unknown[]
  metas: unknown[]
  aportes: unknown[]
  ajustes: unknown
  recurrentes: unknown[]
}

export async function exportarMisDatos(): Promise<ExportarDatos> {
  const res = await api.get<ExportarDatos>('/datos/exportar')
  if (!res.ok || !res.data) throw new Error(res.error ?? 'No se pudo exportar')
  return res.data
}

export interface ResultadoImportar {
  insertadas: number
  categoriasCreadas: string[]
  errores: string[]
}

export async function importarMovimientosCsv(archivo: File): Promise<ResultadoImportar> {
  const fd = new FormData()
  fd.append('archivo', archivo)
  const token = obtenerTokenLocal()
  const res = await fetch(`${API_URL_BACK}/datos/importar-csv`, {
    method: 'POST',
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const texto = await res.text()
  let data: unknown = null
  if (texto) {
    try { data = JSON.parse(texto) } catch { data = texto }
  }
  if (!res.ok) {
    const errBody = data as { message?: string } | null
    throw new Error(errBody?.message ?? `HTTP ${res.status}`)
  }
  return data as ResultadoImportar
}

// Helpers para el importador (no expuesto en el `api` principal porque
// requiere multipart, no JSON).
