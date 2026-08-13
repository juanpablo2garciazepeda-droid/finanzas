import type { ContextoFinanciero } from './alertas'
import { calcularMargen } from './alertas'
import { sumar } from './dinero'
import { ultimosPeriodos } from './fechas'
import { deudaTotal, obligacionMensual } from './deudas'
import { proyectarMeta } from './metas'
import {
  gastoPorCategoria,
  presupuestosDelPeriodo,
  totalPorTipo,
  transaccionesDelPeriodo,
} from './presupuestos'

export interface ComponenteSalud {
  clave: string
  nombre: string
  /** 0 a 1. */
  calificacion: number
  peso: number
  detalle: string
  /** Un componente sin datos no cuenta y su peso se reparte entre los demás. */
  aplicable: boolean
}

export interface Salud {
  puntaje: number
  etiqueta: string
  componentes: ComponenteSalud[]
  /**
   * Si hay base para dar un puntaje. Con un solo componente aplicable el
   * promedio es ese componente: alguien sin deudas ni datos sacaría 100 y se
   * le estaría diciendo que su salud es sólida cuando no se sabe nada de ella.
   */
  suficiente: boolean
}

/** Componentes aplicables mínimos para que el puntaje signifique algo. */
const MINIMO_COMPONENTES = 2

/** Interpola linealmente entre dos topes y acota a [0, 1]. */
function escalar(valor: number, peor: number, mejor: number): number {
  if (mejor === peor) return 0.5
  return Math.min(1, Math.max(0, (valor - peor) / (mejor - peor)))
}

export function etiquetaSalud(puntaje: number): string {
  if (puntaje >= 80) return 'Sólida'
  if (puntaje >= 60) return 'Estable'
  if (puntaje >= 40) return 'Ajustada'
  return 'Frágil'
}

/**
 * Puntaje 0-100 sobre cuatro componentes. Los que no aplican (sin metas, sin
 * presupuestos) se sacan del promedio en vez de contar como cero: castigar a
 * alguien por no haber definido metas todavía no dice nada de su salud.
 */
export function calcularSalud(ctx: ContextoFinanciero): Salud {
  const margen = calcularMargen(ctx)
  const componentes: ComponenteSalud[] = []

  // 1. Tasa de ahorro sobre el promedio de los últimos tres meses.
  const periodos = ultimosPeriodos(ctx.periodo, 3)
  const ingresos = sumar(
    periodos.map((p) => totalPorTipo(transaccionesDelPeriodo(ctx.transacciones, p), 'ingreso')),
  )
  const egresos = sumar(
    periodos.map((p) => totalPorTipo(transaccionesDelPeriodo(ctx.transacciones, p), 'egreso')),
  )
  const tasaAhorro = ingresos > 0 ? (ingresos - egresos) / ingresos : 0
  componentes.push({
    clave: 'ahorro',
    nombre: 'Tasa de ahorro',
    calificacion: escalar(tasaAhorro, 0, 0.2),
    peso: 30,
    detalle:
      ingresos > 0
        ? `Guardas el ${Math.round(tasaAhorro * 100)}% de lo que entra. Una meta sana es 20%.`
        : 'Sin ingresos registrados en el trimestre.',
    aplicable: ingresos > 0,
  })

  // 2. Carga de deuda: lo que se va en pagos frente a lo que entra al mes.
  const total = deudaTotal(ctx.deudas)
  const cargaMensual = obligacionMensual(ctx.deudas)
  const carga = margen.ingresos > 0 ? cargaMensual / margen.ingresos : 0
  componentes.push({
    clave: 'deuda',
    nombre: 'Carga de deuda',
    calificacion: total === 0 ? 1 : escalar(carga, 0.4, 0.05),
    peso: 25,
    detalle:
      total === 0
        ? 'Sin deudas registradas.'
        : `Tus pagos se llevan el ${Math.round(carga * 100)}% de tu ingreso mensual. Bajo 20% es cómodo.`,
    aplicable: margen.ingresos > 0 || total === 0,
  })

  // 3. Cumplimiento de presupuesto en los últimos tres meses.
  let dentro = 0
  let evaluados = 0
  for (const p of periodos) {
    const delMes = transaccionesDelPeriodo(ctx.transacciones, p)
    const gastos = gastoPorCategoria(delMes)
    for (const presupuesto of presupuestosDelPeriodo(ctx.presupuestos, p)) {
      const gastado = presupuesto.categoriaId
        ? (gastos.get(presupuesto.categoriaId) ?? 0)
        : totalPorTipo(delMes, 'egreso')
      evaluados++
      if (gastado <= presupuesto.montoLimite) dentro++
    }
  }
  componentes.push({
    clave: 'presupuesto',
    nombre: 'Cumplimiento de presupuesto',
    calificacion: evaluados > 0 ? dentro / evaluados : 0,
    peso: 25,
    detalle:
      evaluados > 0
        ? `Respetaste ${dentro} de ${evaluados} presupuestos del trimestre.`
        : 'Aún no defines presupuestos.',
    aplicable: evaluados > 0,
  })

  // 4. Metas: avance real contra el avance que tocaría por el tiempo corrido.
  const activas = ctx.metas.filter((m) => !m.completada)
  const avances = activas.map((m) => {
    const proyeccion = proyectarMeta(m, ctx.aportes, ctx.hoy)
    return proyeccion.enRiesgo ? Math.min(1, proyeccion.avance) * 0.5 : 1
  })
  componentes.push({
    clave: 'metas',
    nombre: 'Avance de metas',
    calificacion: avances.length > 0 ? sumar(avances) / avances.length : 0,
    peso: 20,
    detalle:
      activas.length > 0
        ? `${avances.filter((a) => a === 1).length} de ${activas.length} metas van a buen ritmo.`
        : 'Aún no defines metas de ahorro.',
    aplicable: activas.length > 0,
  })

  const aplicables = componentes.filter((c) => c.aplicable)
  const pesoTotal = sumar(aplicables.map((c) => c.peso))
  const puntaje =
    pesoTotal > 0
      ? Math.round((sumar(aplicables.map((c) => c.calificacion * c.peso)) / pesoTotal) * 100)
      : 0

  const suficiente = aplicables.length >= MINIMO_COMPONENTES
  return {
    puntaje,
    etiqueta: suficiente ? etiquetaSalud(puntaje) : 'Sin datos suficientes',
    componentes,
    suficiente,
  }
}

/** Serie de puntos para la gráfica de evolución del mes a mes. */
export interface PuntoHistorico {
  periodo: string
  ingresos: number
  egresos: number
  balance: number
}

export function serieHistorica(ctx: ContextoFinanciero, meses: number): PuntoHistorico[] {
  return ultimosPeriodos(ctx.periodo, meses).map((periodo) => {
    const delMes = transaccionesDelPeriodo(ctx.transacciones, periodo)
    const ingresos = totalPorTipo(delMes, 'ingreso')
    const egresos = totalPorTipo(delMes, 'egreso')
    return { periodo, ingresos, egresos, balance: ingresos - egresos }
  })
}

/**
 * Evolución de deuda y ahorro hacia atrás: se parte del saldo de hoy y se
 * deshacen los movimientos mes a mes. Es la única forma de reconstruir el
 * pasado sin guardar una foto del saldo en cada fecha.
 */
export function serieDeudaYAhorro(
  ctx: ContextoFinanciero,
  pagos: { deudaId: string; monto: number; fecha: string }[],
  meses: number,
): { periodo: string; deuda: number; ahorro: number }[] {
  const periodos = ultimosPeriodos(ctx.periodo, meses)
  let deuda = deudaTotal(ctx.deudas)
  let ahorro = sumar(ctx.metas.map((m) => m.montoActual))

  const serie: { periodo: string; deuda: number; ahorro: number }[] = []
  for (let i = periodos.length - 1; i >= 0; i--) {
    const periodo = periodos[i]
    serie.unshift({ periodo, deuda: Math.max(0, deuda), ahorro: Math.max(0, ahorro) })
    const pagosDelMes = sumar(pagos.filter((p) => p.fecha.slice(0, 7) === periodo).map((p) => p.monto))
    const aportesDelMes = sumar(
      ctx.aportes.filter((a) => a.fecha.slice(0, 7) === periodo).map((a) => a.monto),
    )
    deuda += pagosDelMes
    ahorro -= aportesDelMes
  }
  return serie
}
