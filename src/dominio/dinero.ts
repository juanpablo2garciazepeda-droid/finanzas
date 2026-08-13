/**
 * Todo el dinero vive como entero de centavos hasta el momento de mostrarlo.
 * Sumar floats y compararlos contra un presupuesto produce diferencias de un
 * centavo que en una app de dinero se leen como bugs.
 */

/** Convierte lo que el usuario escribió ("1,234.5", "1234.567") a centavos. */
export function aCentavos(entrada: string | number): number {
  if (typeof entrada === 'number') {
    return Number.isFinite(entrada) ? Math.round(entrada * 100) : 0
  }
  const limpio = entrada.replace(/[^\d.-]/g, '')
  if (limpio === '' || limpio === '-' || limpio === '.') return 0
  const valor = Number.parseFloat(limpio)
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0
}

export function aPesos(centavos: number): number {
  return centavos / 100
}

export function formatearMoneda(
  centavos: number,
  moneda = 'MXN',
  locale = 'es-MX',
  opciones: { conDecimales?: boolean; conSigno?: boolean } = {},
): string {
  const { conDecimales = true, conSigno = false } = opciones
  const texto = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: conDecimales ? 2 : 0,
  }).format(aPesos(centavos))
  return conSigno && centavos > 0 ? `+${texto}` : texto
}

/** Para tarjetas y ejes de gráficas, donde el detalle al centavo estorba. */
export function formatearCompacto(centavos: number, moneda = 'MXN', locale = 'es-MX'): string {
  const pesos = aPesos(centavos)
  if (Math.abs(pesos) < 10_000) {
    return formatearMoneda(centavos, moneda, locale, { conDecimales: false })
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
