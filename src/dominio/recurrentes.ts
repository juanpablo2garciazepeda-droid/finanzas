import type { GastoRecurrente, TipoMovimiento } from './tipos'
import { sumar } from './dinero'
import { periodoDe, sumarMeses } from './fechas'

/**
 * Las plantillas recurrentes son compromisos, no adivinanzas.
 *
 * La renta, el gimnasio y la mensualidad de la escuela ya tienen fecha y
 * monto: son salidas que van a ocurrir sí o sí antes de que cierre el ciclo.
 * Un contador las devenga —las reconoce cuando se contraen, no cuando se
 * pagan—; el semáforo hacía lo contrario y solo las veía el día que el
 * backend generaba el movimiento. El efecto era que el margen se veía
 * cómodo el día 1 y se desplomaba el día 5 sin que hubiera pasado nada
 * nuevo. Lo mismo del otro lado: un sueldo con plantilla dice cuánto entra
 * y CUÁNDO, que es mejor dato que cualquier promedio histórico.
 */

/** La fecha en que toca esta plantilla dentro del mes `periodo`. */
function ocurrenciaEn(periodo: string, diaDelMes: number): string {
  return `${periodo}-${String(diaDelMes).padStart(2, '0')}`
}

/**
 * Ocurrencias de una plantilla dentro de [desde, hasta], ambas incluidas.
 *
 * Se miran dos meses porque el ciclo semanal cruza el cambio de mes: una
 * semana que empieza el 29 de agosto termina el 4 de septiembre, y la renta
 * del día 1 cae dentro de esa ventana.
 */
export function ocurrenciasEnVentana(
  plantilla: GastoRecurrente,
  desde: string,
  hasta: string,
): string[] {
  if (hasta < desde) return []
  const periodos = [periodoDe(desde), sumarMeses(periodoDe(desde), 1)]
  return periodos
    .map((periodo) => ocurrenciaEn(periodo, plantilla.diaDelMes))
    .filter((fecha) => fecha >= desde && fecha <= hasta)
    .filter((fecha) => fecha >= plantilla.iniciaEn)
    .filter((fecha) => !plantilla.terminaEn || fecha <= plantilla.terminaEn)
    // Si el backend ya generó la transacción de esa fecha, el movimiento ya
    // está registrado: volver a contarlo lo duplicaría contra sí mismo.
    .filter((fecha) => !plantilla.ultimoGeneradoEn || plantilla.ultimoGeneradoEn < fecha)
}

function pendientesPorTipo(
  recurrentes: GastoRecurrente[],
  tipo: TipoMovimiento,
  desde: string,
  hasta: string,
): { total: number; primera: string | null } {
  const activas = recurrentes.filter((r) => r.activo && r.tipo === tipo)
  const montos: number[] = []
  let primera: string | null = null
  for (const plantilla of activas) {
    for (const fecha of ocurrenciasEnVentana(plantilla, desde, hasta)) {
      montos.push(plantilla.monto)
      if (primera === null || fecha < primera) primera = fecha
    }
  }
  return { total: sumar(montos), primera }
}

/** Gastos fijos que todavía no se cobran pero caen dentro de la ventana. */
export function egresosFijosPendientes(
  recurrentes: GastoRecurrente[],
  desde: string,
  hasta: string,
): number {
  return pendientesPorTipo(recurrentes, 'egreso', desde, hasta).total
}

/** Ingresos con plantilla que todavía no caen pero caen dentro de la ventana. */
export function ingresosProgramados(
  recurrentes: GastoRecurrente[],
  desde: string,
  hasta: string,
): { total: number; fecha: string | null } {
  const { total, primera } = pendientesPorTipo(recurrentes, 'ingreso', desde, hasta)
  return { total, fecha: primera }
}
