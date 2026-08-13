import type { AporteMeta, PagoDeuda, Transaccion } from './tipos'
import { sumar } from './dinero'

/**
 * Cuánto dinero tienes de verdad, ahora.
 *
 * La app no puede adivinarlo: nadie registra su vida financiera desde el día
 * cero. Así que se declara una vez —"hoy tengo esto en el banco"— y a partir de
 * esa foto se suma y se resta todo lo que se va registrando. Sin ese punto de
 * partida solo se puede razonar sobre flujos (entró tanto, salió tanto), que es
 * útil pero no responde a "¿cuánto tengo?".
 *
 * Qué sale del saldo:
 * - los egresos, obviamente;
 * - los pagos de deuda, porque ese dinero salió de la cuenta;
 * - los aportes a metas, porque se apartaron y dejaron de ser gastables.
 */
export interface Saldo {
  /** Si hay una foto declarada. Sin ella el resto son ceros. */
  declarado: boolean
  inicial: number
  desde: string
  ingresos: number
  egresos: number
  pagosDeuda: number
  aportesMeta: number
  /** Lo que tienes ahora mismo. */
  actual: number
}

export const SALDO_VACIO: Saldo = {
  declarado: false,
  inicial: 0,
  desde: '',
  ingresos: 0,
  egresos: 0,
  pagosDeuda: 0,
  aportesMeta: 0,
  actual: 0,
}

export function calcularSaldo(
  inicial: number,
  desde: string,
  transacciones: Transaccion[],
  pagos: PagoDeuda[],
  aportes: AporteMeta[],
): Saldo {
  if (!desde) return SALDO_VACIO

  // Todo lo registrado a partir de la foto, ella incluida.
  const posteriores = transacciones.filter((t) => t.fecha >= desde)
  const ingresos = sumar(posteriores.filter((t) => t.tipo === 'ingreso').map((t) => t.monto))
  const egresos = sumar(posteriores.filter((t) => t.tipo === 'egreso').map((t) => t.monto))
  const pagosDeuda = sumar(pagos.filter((p) => p.fecha >= desde).map((p) => p.monto))
  const aportesMeta = sumar(aportes.filter((a) => a.fecha >= desde).map((a) => a.monto))

  return {
    declarado: true,
    inicial,
    desde,
    ingresos,
    egresos,
    pagosDeuda,
    aportesMeta,
    actual: inicial + ingresos - egresos - pagosDeuda - aportesMeta,
  }
}
