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
  Meta,
  PagoDeuda,
  Presupuesto,
  Transaccion,
} from '@/dominio/tipos'
import { api } from '@/api/cliente'

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
  if (cambios.umbralPrecaucion !== undefined) out.umbralPrecaucion = aStringBigInt(cambios.umbralPrecaucion)
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
  const [ajustes, categorias, transacciones, presupuestos, deudas, metas] = await Promise.all([
    api.get<ApiAjustes>('/ajustes'),
    api.get<ApiCategoria[]>('/categorias'),
    api.get<ApiTransaccion[]>('/transacciones'),
    api.get<ApiPresupuesto[]>('/presupuestos'),
    api.get<ApiDeuda[]>('/deudas'),
    api.get<ApiMeta[]>('/metas'),
  ])

  // Si alguna llamada falla (ej. ajustes no existe aún), caemos a defaults
  // razonables. Categorías vacías está bien — el backend siembra al registrarse.
  const aj = ajustes.ok && ajustes.data ? ajusteDesdeApi(ajustes.data) : ajustesPorDefecto()

  // Pagos: una llamada por deuda. En producción harías un endpoint /pagos
  // con filtro, pero el actual pide deudaId; es aceptable hasta que crezca.
  const pagos: PagoDeuda[] = []
  if (deudas.ok && deudas.data) {
    const resultados = await Promise.all(
      deudas.data.map((d) => api.get<ApiPagoDeuda[]>(`/deudas/${d.id}/pagos`)),
    )
    for (const r of resultados) {
      if (r.ok && r.data) pagos.push(...r.data.map(pagoDesdeApi))
    }
  }

  const aportes: AporteMeta[] = []
  if (metas.ok && metas.data) {
    const resultados = await Promise.all(
      metas.data.map((m) => api.get<ApiAporteMeta[]>(`/metas/${m.id}/aportes`)),
    )
    for (const r of resultados) {
      if (r.ok && r.data) aportes.push(...r.data.map(aporteDesdeApi))
    }
  }

  return {
    ajustes: aj,
    categorias: categorias.ok && categorias.data ? categorias.data.map(categoriaDesdeApi) : [],
    transacciones:
      transacciones.ok && transacciones.data ? transacciones.data.map(transaccionDesdeApi) : [],
    presupuestos:
      presupuestos.ok && presupuestos.data ? presupuestos.data.map(presupuestoDesdeApi) : [],
    deudas: deudas.ok && deudas.data ? deudas.data.map(deudaDesdeApi) : [],
    pagos,
    metas: metas.ok && metas.data ? metas.data.map(metaDesdeApi) : [],
    aportes,
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
    acento: 'azul',
    diasAvisoVencimiento: 7,
    umbralPrecaucion: 0.8,
    notificacionesActivas: false,
    ultimaRevisionVencimientos: '',
  }
}

// ─── Ajustes ───────────────────────────────────────────────────────────────

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  await api.patch('/ajustes', ajusteHaciaApi(cambios))
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
  // El backend no filtra por query string, así que traemos todos y filtramos
  // en cliente. En la práctica son pocas filas por usuario, no es problema.
  const lista = await api.get<ApiPresupuesto[]>('/presupuestos')
  const existente =
    lista.ok && lista.data
      ? lista.data.find((p) => p.categoriaId === categoriaId && p.periodo === periodo)
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
  const lista = await api.get<ApiPresupuesto[]>('/presupuestos')
  if (!lista.ok || !lista.data) return 0
  const origen = lista.data.filter((p) => p.periodo === desde)
  const yaDefinidas = new Set(
    lista.data.filter((p) => p.periodo === hacia).map((p) => p.categoriaId),
  )
  const nuevos = origen.filter((p) => !yaDefinidas.has(p.categoriaId))
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
  // El backend no expone DELETE /pagos/:id; habría que añadirlo. Mientras
  // tanto, lo dejamos como no-op (un "borrar" local del frontend sin impacto
  // en el servidor es preferible a un error silencioso). Esto se documenta
  // para v2.
  void pagoId
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
  // Igual que eliminarPago: el endpoint de borrado no existe todavía.
  void aporteId
}

export async function reordenarMetas(idsEnOrden: string[]): Promise<void> {
  // El backend no tiene un endpoint batch de reorden. Vamos uno por uno
  // actualizando `prioridad`. En la práctica se reordena arrastrando y son
  // pocas metas, así que no es un problema de rendimiento.
  for (const [indice, id] of idsEnOrden.entries()) {
    await api.patch(`/metas/${id}`, { prioridad: indice + 1 })
  }
}
