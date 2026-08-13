import type { Deuda, PagoDeuda } from './tipos'
import { sumar } from './dinero'
import { diasEntre, pagosPorMes, periodoDe, siguienteOcurrencia, sumarMeses, ultimosPeriodos } from './fechas'

/** Tope de la simulación de amortización: 50 años bastan para decir "nunca". */
const MAX_MESES = 600

export interface ProyeccionDeuda {
  /** Lo que realmente se ha estado pagando al mes, promedio de los últimos 3 meses. */
  ritmoMensual: number
  /** El ritmo usado en la simulación: el real, o el mínimo si aún no hay pagos. */
  ritmoUsado: number
  /** `null` si al ritmo actual la deuda no se liquida nunca. */
  mesesRestantes: number | null
  /** Periodo `YYYY-MM` en que quedaría liquidada. `null` si no se liquida. */
  periodoLiquidacion: string | null
  /** Intereses que se pagarían de aquí a la liquidación. */
  interesProyectado: number
  /** El pago no alcanza a cubrir ni los intereses del mes. */
  ahogada: boolean
  totalPagado: number
  avance: number
  /** Cuántos abonos faltan a este ritmo. `null` si no se liquida nunca. */
  pagosRestantes: number | null
  /** Lo que esta deuda exige al mes, sin importar la fecha de corte. */
  obligacionMensual: number
}

export function pagosDeDeuda(pagos: PagoDeuda[], deudaId: string): PagoDeuda[] {
  return pagos.filter((p) => p.deudaId === deudaId)
}

/**
 * Simula la amortización mes a mes: el saldo gana el interés mensual y luego
 * recibe el pago. Devuelve cuántos meses faltan, o `null` si el pago no basta
 * ni para los intereses y el saldo nunca baja.
 */
export function simularLiquidacion(
  saldo: number,
  pagoMensual: number,
  tasaAnual: number | null,
): { meses: number | null; interes: number } {
  if (saldo <= 0) return { meses: 0, interes: 0 }
  if (pagoMensual <= 0) return { meses: null, interes: 0 }

  const tasaMensual = tasaAnual && tasaAnual > 0 ? tasaAnual / 100 / 12 : 0
  let restante = saldo
  let interesTotal = 0

  for (let mes = 1; mes <= MAX_MESES; mes++) {
    const interes = Math.round(restante * tasaMensual)
    if (pagoMensual <= interes) return { meses: null, interes: 0 }
    interesTotal += interes
    restante = restante + interes - pagoMensual
    if (restante <= 0) return { meses: mes, interes: interesTotal }
  }
  return { meses: null, interes: 0 }
}

export function proyectarDeuda(deuda: Deuda, pagos: PagoDeuda[], hoy: string): ProyeccionDeuda {
  const mios = pagosDeDeuda(pagos, deuda.id)
  const totalPagado = sumar(mios.map((p) => p.monto))

  // Ritmo real: lo pagado en los tres meses anteriores completos más el actual.
  const ventana = new Set(ultimosPeriodos(periodoDe(hoy), 3))
  const enVentana = mios.filter((p) => ventana.has(periodoDe(p.fecha)))
  const ritmoMensual = enVentana.length > 0 ? Math.round(sumar(enVentana.map((p) => p.monto)) / 3) : 0

  const minimoMensual = deuda.pagoMinimo * (pagosPorMes(deuda.periodicidad) || 1)
  const ritmoUsado = ritmoMensual > 0 ? ritmoMensual : minimoMensual

  const { meses, interes } = simularLiquidacion(deuda.saldoActual, ritmoUsado, deuda.tasaInteres)

  const porMes = pagosPorMes(deuda.periodicidad) || 1

  return {
    ritmoMensual,
    ritmoUsado,
    mesesRestantes: meses,
    periodoLiquidacion: meses === null ? null : sumarMeses(periodoDe(hoy), meses),
    interesProyectado: interes,
    ahogada: meses === null && ritmoUsado > 0,
    totalPagado,
    avance: deuda.montoOriginal > 0 ? 1 - deuda.saldoActual / deuda.montoOriginal : 0,
    pagosRestantes:
      meses === null ? null : deuda.periodicidad === 'unico' ? 1 : Math.max(1, Math.ceil(meses * porMes)),
    obligacionMensual: Math.min(minimoMensual, deuda.saldoActual),
  }
}

/**
 * Cuántos abonos hacen falta para cubrir un monto, y cuánto toca por abono.
 * Es lo que el formulario de deuda usa para responder "¿de cuánto me sale?"
 * mientras se escribe, sin tener que guardar nada todavía.
 */
export function planDePagos(
  monto: number,
  numeroDePagos: number,
  tasaAnual: number | null,
  periodicidad: string,
): { porPago: number; mensual: number; totalConIntereses: number } {
  if (monto <= 0 || numeroDePagos <= 0) return { porPago: 0, mensual: 0, totalConIntereses: monto }

  const porMes = pagosPorMes(periodicidad) || 1
  const tasaPorPeriodo = tasaAnual && tasaAnual > 0 ? tasaAnual / 100 / 12 / porMes : 0

  // Fórmula de anualidad: sin tasa se reduce a dividir el monto entre los pagos.
  const porPago =
    tasaPorPeriodo === 0
      ? Math.ceil(monto / numeroDePagos)
      : Math.ceil(
          (monto * tasaPorPeriodo) / (1 - Math.pow(1 + tasaPorPeriodo, -numeroDePagos)),
        )

  return {
    porPago,
    mensual: Math.round(porPago * porMes),
    totalConIntereses: porPago * numeroDePagos,
  }
}

export interface Vencimiento {
  deuda: Deuda
  fecha: string
  dias: number
  monto: number
  vencido: boolean
}

/**
 * Próximos pagos ordenados por urgencia. Las fechas ya pasadas se adelantan a
 * su siguiente ocurrencia salvo que la deuda sea de pago único, donde un
 * vencimiento pasado sigue vencido y debe verse así.
 */
export function proximosVencimientos(deudas: Deuda[], hoy: string, dentroDeDias = 30): Vencimiento[] {
  return deudas
    .filter((d) => !d.liquidada && d.saldoActual > 0)
    .map((d) => {
      const fecha =
        d.periodicidad === 'unico' ? d.fechaLimite : siguienteOcurrencia(d.fechaLimite, d.periodicidad, hoy)
      const dias = diasEntre(hoy, fecha)
      return {
        deuda: d,
        fecha,
        dias,
        monto: Math.min(d.pagoMinimo > 0 ? d.pagoMinimo : d.saldoActual, d.saldoActual),
        vencido: dias < 0,
      }
    })
    .filter((v) => v.dias <= dentroDeDias)
    .sort((a, b) => a.dias - b.dias)
}

/** Lo que hay que apartar sí o sí en los próximos `dias` días. */
export function compromisoDeudas(deudas: Deuda[], hoy: string, dias: number): number {
  return sumar(proximosVencimientos(deudas, hoy, dias).map((v) => v.monto))
}

/**
 * Lo que las deudas exigen cada mes, sin mirar fechas de corte. El semáforo sí
 * depende del calendario, pero un puntaje de salud no puede subir y bajar según
 * el día del mes en que se consulte.
 */
export function obligacionMensual(deudas: Deuda[]): number {
  return sumar(
    deudas
      .filter((d) => !d.liquidada && d.saldoActual > 0)
      .map((d) => {
        const porMes = pagosPorMes(d.periodicidad)
        const mensual = porMes > 0 ? d.pagoMinimo * porMes : d.pagoMinimo
        return Math.min(mensual, d.saldoActual)
      }),
  )
}

/** Saldo total vivo. */
export function deudaTotal(deudas: Deuda[]): number {
  return sumar(deudas.filter((d) => !d.liquidada).map((d) => d.saldoActual))
}

/**
 * La deuda que más conviene atacar con dinero extra: la de mayor tasa
 * (método avalancha). Sin tasas registradas, la de saldo más chico, que es la
 * que se quita de encima más rápido.
 */
export function deudaPrioritaria(deudas: Deuda[]): Deuda | null {
  const vivas = deudas.filter((d) => !d.liquidada && d.saldoActual > 0)
  if (vivas.length === 0) return null
  const conTasa = vivas.filter((d) => (d.tasaInteres ?? 0) > 0)
  if (conTasa.length > 0) {
    return conTasa.reduce((a, b) => ((b.tasaInteres ?? 0) > (a.tasaInteres ?? 0) ? b : a))
  }
  return vivas.reduce((a, b) => (b.saldoActual < a.saldoActual ? b : a))
}

/** Cuántos meses se recortan si al pago mensual se le suman `extra` centavos. */
export function mesesAhorrados(deuda: Deuda, ritmoActual: number, extra: number): number {
  if (ritmoActual <= 0 || extra <= 0) return 0
  const base = simularLiquidacion(deuda.saldoActual, ritmoActual, deuda.tasaInteres)
  const conExtra = simularLiquidacion(deuda.saldoActual, ritmoActual + extra, deuda.tasaInteres)
  if (base.meses === null) return conExtra.meses === null ? 0 : MAX_MESES
  if (conExtra.meses === null) return 0
  return Math.max(0, base.meses - conExtra.meses)
}
