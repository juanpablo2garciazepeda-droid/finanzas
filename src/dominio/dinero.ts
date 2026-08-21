/**
 * Todo el dinero vive como entero de centavos hasta el momento de mostrarlo.
 * Sumar floats y compararlos contra un presupuesto produce diferencias de un
 * centavo que en una app de dinero se leen como bugs.
 */

/**
 * Convierte lo que el usuario escribió ("1,234.5", "1234.567") a centavos.
 *
 * El texto se parte en parte entera y decimales y se opera sobre los dígitos,
 * no sobre un float. `Math.round(3.545 * 100)` depende de cómo cayó el binario
 * —da 354 unas veces y 355 otras— y eso en una app de dinero se ve como que la
 * app "se come" un centavo sin motivo.
 */
export function aCentavos(entrada: string | number): number {
  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) return 0
    // `toFixed` redondea en decimal y absorbe el ruido binario de la escala.
    return Math.round(Number(entrada.toFixed(2)) * 100)
  }

  const limpio = entrada.replace(/[^\d.-]/g, '')
  if (limpio === '' || limpio === '-' || limpio === '.') return 0

  const negativo = limpio.trimStart().startsWith('-')
  const [enteroCrudo = '', ...resto] = limpio.replace(/-/g, '').split('.')
  const decimalCrudo = resto.join('')
  if (enteroCrudo === '' && decimalCrudo === '') return 0

  const entero = enteroCrudo === '' ? 0 : Number(enteroCrudo)
  if (!Number.isFinite(entero)) return 0

  // Tres dígitos: los dos que se guardan y el que decide el redondeo.
  const decimales = `${decimalCrudo}000`.slice(0, 3)
  const centavos =
    entero * 100 + Number(decimales.slice(0, 2)) + (Number(decimales[2]) >= 5 ? 1 : 0)

  return negativo ? -centavos : centavos
}

export function aPesos(centavos: number): number {
  return centavos / 100
}

/** `true` si el monto trae centavos que no son cero. */
export function tieneCentavos(centavos: number): boolean {
  return Math.round(centavos) % 100 !== 0
}

/**
 * Cómo se enseña un monto.
 *
 * - `true`  → siempre dos decimales. Listas de movimientos, donde las columnas
 *   tienen que alinear aunque el importe sea redondo.
 * - `false` → nunca decimales. Ejes de gráficas y tarjetas de resumen, donde
 *   el centavo estorba y ninguna decisión depende de él.
 * - `'auto'` → los decimales aparecen solo si existen. Es el modo correcto
 *   para cualquier cifra que responda a "¿cuánto tengo?": redondear $3.50 a
 *   $4 es inventar 50 centavos, y quien declaró ese saldo lo lee como que la
 *   app no le está haciendo caso.
 */
export type ModoDecimales = boolean | 'auto'

export function formatearMoneda(
  centavos: number,
  moneda = 'MXN',
  locale = 'es-MX',
  opciones: { conDecimales?: ModoDecimales; conSigno?: boolean } = {},
): string {
  const { conDecimales = true, conSigno = false } = opciones
  const mostrarDecimales =
    conDecimales === 'auto' ? tieneCentavos(centavos) : conDecimales
  const texto = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: mostrarDecimales ? 2 : 0,
    maximumFractionDigits: mostrarDecimales ? 2 : 0,
  }).format(aPesos(centavos))
  return conSigno && centavos > 0 ? `+${texto}` : texto
}

/** Para tarjetas y ejes de gráficas, donde el detalle al centavo estorba. */
export function formatearCompacto(centavos: number, moneda = 'MXN', locale = 'es-MX'): string {
  const pesos = aPesos(centavos)
  if (Math.abs(pesos) < 10_000) {
    return formatearMoneda(centavos, moneda, locale, { conDecimales: 'auto' })
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(pesos)
}

export function formatearPorcentaje(fraccion: number, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraccion)
}

export function sumar(montos: number[]): number {
  let total = 0
  for (const monto of montos) total += monto
  return total
}

/** Fracción consumida, acotada a [0, ∞). Un límite de 0 no divide entre cero. */
export function fraccion(parte: number, total: number): number {
  if (total <= 0) return parte > 0 ? 1 : 0
  return Math.max(0, parte / total)
}
