import type { TipoCiclo } from './tipos'
import { aFechaLocal, aISO, diasDelPeriodo, diasEntre, periodoDe } from './fechas'

/**
 * Ciclo de cobro: la ventana real sobre la que una persona decide si puede
 * gastar. Quien cobra por quincena no piensa en meses, piensa en "lo que me
 * queda hasta el día 15".
 */
export interface Ciclo {
  tipo: TipoCiclo
  inicio: string
  fin: string
  diasTotales: number
  /** Días que faltan para cerrar el ciclo, contando hoy. */
  diasRestantes: number
  /** Cuántos ciclos de este tipo caben en un mes. */
  porMes: number
  /** Ciclos que quedan del mes contando el actual. Reparte lo mensual. */
  restantesEnMes: number
  nombre: string
}

function armar(tipo: TipoCiclo, inicio: string, fin: string, hoy: string, porMes: number, restantesEnMes: number, nombre: string): Ciclo {
  return {
    tipo,
    inicio,
    fin,
    diasTotales: diasEntre(inicio, fin) + 1,
    diasRestantes: Math.max(1, diasEntre(hoy, fin) + 1),
    porMes,
    restantesEnMes,
    nombre,
  }
}

export function cicloDe(hoy: string, tipo: TipoCiclo): Ciclo {
  const periodo = periodoDe(hoy)
  const ultimoDia = diasDelPeriodo(periodo)
  const dia = Number(hoy.slice(8, 10))
  const dd = (n: number) => `${periodo}-${String(n).padStart(2, '0')}`

  if (tipo === 'quincenal') {
    // Primera quincena del 1 al 15; la segunda hasta el último día del mes.
    return dia <= 15
      ? armar('quincenal', dd(1), dd(15), hoy, 2, 2, 'quincena')
      : armar('quincenal', dd(16), dd(ultimoDia), hoy, 2, 1, 'quincena')
  }

  if (tipo === 'semanal') {
    // Semana de lunes a domingo. getDay() da 0 en domingo.
    const fecha = aFechaLocal(hoy)
    const desplazamiento = (fecha.getDay() + 6) % 7
    const lunes = aFechaLocal(hoy)
    lunes.setDate(lunes.getDate() - desplazamiento)
    const domingo = aFechaLocal(aISO(lunes))
    domingo.setDate(domingo.getDate() + 6)
    // Las semanas cruzan meses; para repartir lo mensual se usa lo que queda
    // del mes en curso, no siete días fijos.
    const restantes = Math.max(1, Math.ceil((ultimoDia - dia + 1) / 7))
    return armar('semanal', aISO(lunes), aISO(domingo), hoy, 4, restantes, 'semana')
  }

  return armar('mensual', dd(1), dd(ultimoDia), hoy, 1, 1, 'mes')
}

export const NOMBRE_CICLO: Record<TipoCiclo, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal',
  semanal: 'Semanal',
}

/** Frase para el tablero: "esta quincena", "este mes", "esta semana". */
export function esteCiclo(tipo: TipoCiclo): string {
  return tipo === 'mensual' ? 'este mes' : tipo === 'quincenal' ? 'esta quincena' : 'esta semana'
}

export function delCiclo(tipo: TipoCiclo): string {
  return tipo === 'mensual' ? 'del mes' : tipo === 'quincenal' ? 'de la quincena' : 'de la semana'
}
