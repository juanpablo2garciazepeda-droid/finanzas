import type { AporteMeta, Meta } from './tipos'
import { sumar } from './dinero'
import { diasEntre, mesesEntre, periodoDe, sumarMeses, ultimosPeriodos } from './fechas'

export interface ProyeccionMeta {
  faltante: number
  avance: number
  /** Promedio aportado al mes en los últimos 3 meses. */
  ritmoMensual: number
  /** Meses hasta juntar el objetivo al ritmo actual. `null` si no hay ritmo. */
  mesesAlObjetivo: number | null
  /** Periodo `YYYY-MM` proyectado de llegada. `null` si al ritmo actual no llega. */
  periodoProyectado: string | null
  /** Lo que habría que apartar cada mes para llegar a tiempo. */
  aporteNecesario: number
  mesesDisponibles: number
  /** El ritmo actual no alcanza para cumplir la fecha límite. */
  enRiesgo: boolean
  vencida: boolean
}

export function aportesDeMeta(aportes: AporteMeta[], metaId: string): AporteMeta[] {
  return aportes.filter((a) => a.metaId === metaId)
}

export function proyectarMeta(meta: Meta, aportes: AporteMeta[], hoy: string): ProyeccionMeta {
  const mios = aportesDeMeta(aportes, meta.id)
  const faltante = Math.max(0, meta.montoObjetivo - meta.montoActual)
  const avance = meta.montoObjetivo > 0 ? meta.montoActual / meta.montoObjetivo : 0

  const ventana = new Set(ultimosPeriodos(periodoDe(hoy), 3))
  const enVentana = mios.filter((a) => ventana.has(periodoDe(a.fecha)))
  const ritmoMensual = enVentana.length > 0 ? Math.round(sumar(enVentana.map((a) => a.monto)) / 3) : 0

  // Si aún no hay historial, el plan del usuario es la mejor estimación.
  const ritmoUsado = ritmoMensual > 0 ? ritmoMensual : meta.aporteMensual
  const mesesAlObjetivo = faltante === 0 ? 0 : ritmoUsado > 0 ? Math.ceil(faltante / ritmoUsado) : null

  // Al menos un mes: una meta que vence este mes todavía se puede cumplir hoy.
  const mesesDisponibles = Math.max(1, mesesEntre(hoy, meta.fechaLimite) + 1)
  const aporteNecesario = faltante === 0 ? 0 : Math.ceil(faltante / mesesDisponibles)

  return {
    faltante,
    avance,
    ritmoMensual,
    mesesAlObjetivo,
    periodoProyectado: mesesAlObjetivo === null ? null : sumarMeses(periodoDe(hoy), mesesAlObjetivo),
    aporteNecesario,
    mesesDisponibles,
    enRiesgo: faltante > 0 && (mesesAlObjetivo === null || mesesAlObjetivo > mesesDisponibles),
    vencida: faltante > 0 && diasEntre(hoy, meta.fechaLimite) < 0,
  }
}

export function ahorroTotal(metas: Meta[]): number {
  return sumar(metas.map((m) => m.montoActual))
}

/**
 * Lo que falta apartar este mes para las metas activas: el plan mensual menos
 * lo que ya se aportó en el periodo. Este es el número que el semáforo
 * descuenta del margen antes de dar luz verde a un gasto.
 */
export function compromisoMetas(metas: Meta[], aportes: AporteMeta[], periodo: string): number {
  let total = 0
  for (const meta of metas) {
    if (meta.completada || meta.aporteMensual <= 0) continue
    const yaAportado = sumar(
      aportes.filter((a) => a.metaId === meta.id && periodoDe(a.fecha) === periodo).map((a) => a.monto),
    )
    const pendiente = Math.min(
      meta.aporteMensual - yaAportado,
      Math.max(0, meta.montoObjetivo - meta.montoActual),
    )
    if (pendiente > 0) total += pendiente
  }
  return total
}
