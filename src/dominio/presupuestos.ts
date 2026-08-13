import type { Categoria, NivelAlerta, Presupuesto, Transaccion } from './tipos'
import { fraccion, sumar } from './dinero'
import { periodoDe } from './fechas'

export interface EstadoPresupuesto {
  /** `null` en el presupuesto global del mes. */
  categoriaId: string | null
  nombre: string
  icono: string
  color: string
  limite: number
  gastado: number
  /** Puede ser negativo: eso es exactamente lo que se quiere mostrar. */
  restante: number
  /** Fracción consumida. Pasa de 1 cuando hay sobregiro. */
  consumo: number
  nivel: NivelAlerta
}

export function nivelPorConsumo(consumo: number, umbralPrecaucion: number): NivelAlerta {
  if (consumo >= 1) return 'rojo'
  if (consumo >= umbralPrecaucion) return 'ambar'
  return 'verde'
}

export function gastoPorCategoria(transacciones: Transaccion[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const t of transacciones) {
    if (t.tipo !== 'egreso') continue
    mapa.set(t.categoriaId, (mapa.get(t.categoriaId) ?? 0) + t.monto)
  }
  return mapa
}

export function totalPorTipo(transacciones: Transaccion[], tipo: 'ingreso' | 'egreso'): number {
  return sumar(transacciones.filter((t) => t.tipo === tipo).map((t) => t.monto))
}

export function transaccionesDelPeriodo(transacciones: Transaccion[], periodo: string): Transaccion[] {
  return transacciones.filter((t) => periodoDe(t.fecha) === periodo)
}

export function presupuestosDelPeriodo(presupuestos: Presupuesto[], periodo: string): Presupuesto[] {
  return presupuestos.filter((p) => p.periodo === periodo)
}

/**
 * Estado de cada presupuesto definido para el periodo. Solo aparecen las
 * categorías que tienen un límite: sin límite no hay nada contra qué medir.
 */
export function calcularEstados(
  presupuestos: Presupuesto[],
  transacciones: Transaccion[],
  categorias: Categoria[],
  umbralPrecaucion: number,
): EstadoPresupuesto[] {
  const gastos = gastoPorCategoria(transacciones)
  const porId = new Map(categorias.map((c) => [c.id, c]))

  return presupuestos
    .map((p) => {
      const categoria = p.categoriaId ? porId.get(p.categoriaId) : undefined
      const gastado = p.categoriaId
        ? (gastos.get(p.categoriaId) ?? 0)
        : totalPorTipo(transacciones, 'egreso')
      const consumo = fraccion(gastado, p.montoLimite)
      return {
        categoriaId: p.categoriaId,
        nombre: p.categoriaId ? (categoria?.nombre ?? 'Categoría eliminada') : 'Todo el mes',
        icono: p.categoriaId ? (categoria?.icono ?? 'CircleHelp') : 'Wallet',
        color: p.categoriaId ? (categoria?.color ?? '#86868B') : '#0071E3',
        limite: p.montoLimite,
        gastado,
        restante: p.montoLimite - gastado,
        consumo,
        nivel: nivelPorConsumo(consumo, umbralPrecaucion),
      }
    })
    .sort((a, b) => b.consumo - a.consumo)
}

export interface ComparativaCategoria {
  categoriaId: string
  nombre: string
  icono: string
  color: string
  actual: number
  anterior: number
  /** Variación relativa. `null` cuando el mes anterior fue cero y no hay base de comparación. */
  variacion: number | null
}

export function compararPeriodos(
  transaccionesActual: Transaccion[],
  transaccionesAnterior: Transaccion[],
  categorias: Categoria[],
): ComparativaCategoria[] {
  const actual = gastoPorCategoria(transaccionesActual)
  const anterior = gastoPorCategoria(transaccionesAnterior)
  const ids = new Set([...actual.keys(), ...anterior.keys()])
  const porId = new Map(categorias.map((c) => [c.id, c]))

  return [...ids]
    .map((id) => {
      const a = actual.get(id) ?? 0
      const b = anterior.get(id) ?? 0
      const categoria = porId.get(id)
      return {
        categoriaId: id,
        nombre: categoria?.nombre ?? 'Sin categoría',
        icono: categoria?.icono ?? 'CircleHelp',
        color: categoria?.color ?? '#86868B',
        actual: a,
        anterior: b,
        variacion: b === 0 ? null : (a - b) / b,
      }
    })
    .sort((x, y) => y.actual - x.actual)
}
