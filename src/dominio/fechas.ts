/**
 * Fechas como texto `YYYY-MM-DD` y periodos como `YYYY-MM`.
 *
 * Nunca se pasa una fecha ISO a `new Date(texto)` directamente: el navegador la
 * interpreta como UTC y un gasto del día 31 en México aparece registrado el 1
 * del mes siguiente. Aquí siempre se parte el texto y se construye la fecha en
 * hora local.
 */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function aFechaLocal(iso: string): Date {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function aISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function hoyISO(): string {
  return aISO(new Date())
}

/** `2026-08-13` → `2026-08` */
export function periodoDe(iso: string): string {
  return iso.slice(0, 7)
}

export function periodoActual(): string {
  return periodoDe(hoyISO())
}

/**
 * El periodo más viejo de un puñado de fechas: el suelo del navegador de mes.
 *
 * Recibe las fechas sueltas (movimientos, pagos, aportes, el saldo inicial) en
 * vez del contexto entero para que siga siendo una función de dominio sin
 * conocer la forma de los datos de la app.
 *
 * Dos reglas que no son obvias:
 *   · Sin fechas útiles devuelve el mes en curso, no una cadena vacía. Una
 *     cuenta recién creada no tiene historia hacia atrás.
 *   · Nunca devuelve un periodo futuro. Un año mal capturado ("2062" por
 *     "2026") abriría meses que todavía no existen; el tope es el mes actual.
 *
 * Los periodos son 'YYYY-MM', así que comparar cadenas ordena igual que
 * comparar fechas y no hace falta construir Date.
 */
export function periodoMasAntiguo(fechas: (string | null | undefined)[]): string {
  const actual = periodoActual()
  let minimo: string | null = null
  for (const fecha of fechas) {
    if (!fecha) continue
    const periodo = periodoDe(fecha)
    if (periodo === '' || periodo > actual) continue
    if (minimo === null || periodo < minimo) minimo = periodo
  }
  return minimo ?? actual
}

export function sumarMeses(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const fecha = new Date(anio, mes - 1 + meses, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

export function periodoAnterior(periodo: string): string {
  return sumarMeses(periodo, -1)
}

/** Los últimos `cantidad` periodos terminando en `periodo`, del más viejo al más nuevo. */
export function ultimosPeriodos(periodo: string, cantidad: number): string[] {
  const lista: string[] = []
  for (let i = cantidad - 1; i >= 0; i--) lista.push(sumarMeses(periodo, -i))
  return lista
}

/** Rango cerrado `[inicio, fin]` que cubre el mes completo. */
export function rangoPeriodo(periodo: string): { inicio: string; fin: string } {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return {
    inicio: `${periodo}-01`,
    fin: `${periodo}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

export function diasDelPeriodo(periodo: string): number {
  const [anio, mes] = periodo.split('-').map(Number)
  return new Date(anio, mes, 0).getDate()
}

/** Días entre dos fechas. Negativo si `hasta` ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  const ms = aFechaLocal(hasta).getTime() - aFechaLocal(desde).getTime()
  return Math.round(ms / 86_400_000)
}

export function mesesEntre(desde: string, hasta: string): number {
  const a = aFechaLocal(desde)
  const b = aFechaLocal(hasta)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = aFechaLocal(iso)
  fecha.setDate(fecha.getDate() + dias)
  return aISO(fecha)
}

/** Cuántos días quedan del mes contando hoy. */
export function diasRestantesDelPeriodo(hoy: string): number {
  const periodo = periodoDe(hoy)
  return diasDelPeriodo(periodo) - Number(hoy.slice(8, 10)) + 1
}

/** `2026-08` → `agosto 2026` */
export function nombrePeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return `${MESES[mes - 1]} ${anio}`
}

/** `2026-08` → `ago` */
export function periodoCorto(periodo: string): string {
  const mes = Number(periodo.split('-')[1])
  return MESES[mes - 1].slice(0, 3)
}

export function formatearFecha(iso: string, locale = 'es-MX'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(aFechaLocal(iso))
}

export function formatearFechaCorta(iso: string, locale = 'es-MX'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(aFechaLocal(iso))
}

/**
 * "1 día" / "3 días".
 *
 * Existe porque la app repite esta cuenta en media docena de sitios —el
 * tablero, las recomendaciones, los vencimientos— y en varios de ellos salía
 * "vence en 1 días". Es un detalle, pero es el tipo de detalle que le quita
 * credibilidad a una app que presume de calcular bien.
 */
export function enDias(dias: number): string {
  return `${dias} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
}

/** "hoy", "mañana", "en 3 días", "hace 2 días". */
export function fechaRelativa(desde: string, hasta: string): string {
  const dias = diasEntre(desde, hasta)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias === -1) return 'ayer'
  if (dias > 0) return `en ${enDias(dias)}`
  return `hace ${enDias(Math.abs(dias))}`
}

const DIAS_POR_PERIODICIDAD: Record<string, number> = {
  semanal: 7,
  quincenal: 15,
  mensual: 30,
  unico: 0,
}

/**
 * Avanza una fecha de pago vencida hasta la siguiente ocurrencia futura.
 * Un pago mensual del día 5 sigue siendo del día 5 el mes que entra, así que
 * los mensuales avanzan por mes calendario y no por 30 días.
 */
export function siguienteOcurrencia(fechaLimite: string, periodicidad: string, hoy: string): string {
  if (periodicidad === 'unico') return fechaLimite
  let fecha = fechaLimite
  let vueltas = 0
  while (diasEntre(hoy, fecha) < 0 && vueltas < 600) {
    if (periodicidad === 'mensual') {
      const d = aFechaLocal(fecha)
      d.setMonth(d.getMonth() + 1)
      fecha = aISO(d)
    } else {
      fecha = sumarDias(fecha, DIAS_POR_PERIODICIDAD[periodicidad] ?? 30)
    }
    vueltas++
  }
  return fecha
}

/** Cuántos pagos de esta periodicidad caben en un mes. */
export function pagosPorMes(periodicidad: string): number {
  switch (periodicidad) {
    case 'semanal':
      return 4
    case 'quincenal':
      return 2
    case 'mensual':
      return 1
    default:
      return 0
  }
}
