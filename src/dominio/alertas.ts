import type {
  AporteMeta,
  Ajustes,
  Categoria,
  Deuda,
  Meta,
  NivelAlerta,
  PagoDeuda,
  Presupuesto,
  Razon,
  Transaccion,
  Veredicto,
} from './tipos'
import { formatearMoneda, formatearPorcentaje, fraccion, sumar } from './dinero'
import { periodoAnterior, periodoDe, ultimosPeriodos } from './fechas'
import { cicloDe, esteCiclo, type Ciclo } from './ciclos'
import { compromisoDeudas, proximosVencimientos } from './deudas'
import { compromisoMetas } from './metas'
import { calcularSaldo, type Saldo } from './saldo'
import { presupuestosDelPeriodo, totalPorTipo, transaccionesDelPeriodo } from './presupuestos'

export interface ContextoFinanciero {
  hoy: string
  periodo: string
  ajustes: Ajustes
  categorias: Categoria[]
  /** Historial reciente; el periodo en curso se recorta aquí dentro. */
  transacciones: Transaccion[]
  /** Todos los periodos; se filtran aquí dentro. */
  presupuestos: Presupuesto[]
  deudas: Deuda[]
  /** Abonos a deuda: salen de la cuenta, así que cuentan para el saldo. */
  pagos: PagoDeuda[]
  metas: Meta[]
  aportes: AporteMeta[]
}

export interface Margen {
  /** Ventana sobre la que se calculó todo: mes, quincena o semana. */
  ciclo: Ciclo
  /** Lo que se usa para calcular: real si lo hay, estimado si no. */
  ingresos: number
  /** Lo que de verdad entró y está registrado. Nunca una estimación. */
  ingresosReales: number
  egresos: number
  /** Ingresos menos egresos del ciclo. */
  balance: number
  /** Pagos de deuda que vencen antes de que cierre el ciclo. */
  compromisoDeuda: number
  /** La parte del aporte a metas que toca a este ciclo. */
  compromisoMeta: number
  /** Lo que queda de verdad disponible: balance menos compromisos. */
  margenLibre: number
  /** Los ingresos del ciclo aún no aparecen y se estimó con otra fuente. */
  ingresosEstimados: boolean
  /** El dinero real, si la persona declaró su saldo. */
  saldo: Saldo
  diasRestantes: number
  /** Cuánto se puede gastar hoy sin agotar el margen antes de que cierre. */
  gastoDiarioSugerido: number
}

const ORDEN: Record<NivelAlerta, number> = { verde: 0, ambar: 1, rojo: 2 }

export function peorNivel(niveles: NivelAlerta[]): NivelAlerta {
  return niveles.reduce<NivelAlerta>((peor, n) => (ORDEN[n] > ORDEN[peor] ? n : peor), 'verde')
}

/**
 * Ingreso mensual típico según los tres periodos anteriores. Sirve para no
 * pintar todo en rojo los primeros días del mes, cuando ya hay gastos
 * registrados pero la nómina todavía no cae.
 */
export function ingresoTipico(transacciones: Transaccion[], periodo: string): number {
  const periodos = ultimosPeriodos(periodoAnterior(periodo), 3)
  const totales = periodos.map((p) => totalPorTipo(transaccionesDelPeriodo(transacciones, p), 'ingreso'))
  const conIngreso = totales.filter((t) => t > 0)
  if (conIngreso.length === 0) return 0
  return Math.round(sumar(conIngreso) / conIngreso.length)
}

/**
 * El margen se calcula sobre el ciclo de cobro, no sobre el mes. Quien cobra
 * por quincena decide con lo que le queda hasta el día 15; decirle cuánto le
 * sobra "en el mes" no le sirve para nada en la caja del súper.
 *
 * Al mirar un mes que no es el actual no hay "hoy" dentro de él, así que se
 * usa el mes completo: ahí la pregunta ya no es "¿puedo gastar?" sino "¿cómo
 * me fue?".
 */
export function calcularMargen(ctx: ContextoFinanciero): Margen {
  const esMesActual = periodoDe(ctx.hoy) === ctx.periodo
  const ciclo = esMesActual
    ? cicloDe(ctx.hoy, ctx.ajustes.cicloPago)
    : cicloDe(`${ctx.periodo}-15`, 'mensual')

  const enCiclo = ctx.transacciones.filter((t) => t.fecha >= ciclo.inicio && t.fecha <= ciclo.fin)
  const ingresosReales = totalPorTipo(enCiclo, 'ingreso')
  const egresos = totalPorTipo(enCiclo, 'egreso')

  // Orden de confianza: lo que de verdad entró en el ciclo; si aún no entra
  // nada, la parte del sueldo configurado que toca al ciclo; y si tampoco está
  // configurado, su promedio histórico repartido igual.
  const mensualEstimado =
    ctx.ajustes.ingresoMensual > 0
      ? ctx.ajustes.ingresoMensual
      : ingresoTipico(ctx.transacciones, ctx.periodo)
  const estimado = ingresosReales === 0 ? Math.round(mensualEstimado / ciclo.porMes) : 0
  const ingresos = ingresosReales > 0 ? ingresosReales : estimado

  // Los pagos que caen dentro del ciclo, y como mínimo la ventana de aviso que
  // la persona configuró: si su corte es mañana, no puede sorprenderla.
  const dias = Math.max(ciclo.diasRestantes, ctx.ajustes.diasAvisoVencimiento)
  const compromisoDeuda = compromisoDeudas(ctx.deudas, ctx.hoy, dias)

  // El aporte a metas es mensual; a este ciclo le toca su parte proporcional
  // de lo que aún falta apartar en el mes.
  const pendienteMes = compromisoMetas(ctx.metas, ctx.aportes, ctx.periodo)
  const compromisoMeta = Math.ceil(pendienteMes / ciclo.restantesEnMes)

  const saldo = calcularSaldo(
    ctx.ajustes.saldoInicial,
    ctx.ajustes.saldoInicialFecha,
    ctx.transacciones,
    ctx.pagos,
    ctx.aportes,
  )

  // Con saldo declarado el punto de partida es el dinero que hay, no la resta
  // de flujos del ciclo: saber cuánto tienes gana sobre inferir cuánto entró.
  const balance = saldo.declarado ? saldo.actual : ingresos - egresos
  const margenLibre = balance - compromisoDeuda - compromisoMeta
  const diasRestantes = esMesActual ? ciclo.diasRestantes : 0

  return {
    ciclo,
    ingresos,
    ingresosReales,
    egresos,
    saldo,
    balance,
    compromisoDeuda,
    compromisoMeta,
    margenLibre,
    ingresosEstimados: ingresosReales === 0 && estimado > 0,
    diasRestantes,
    gastoDiarioSugerido: diasRestantes > 0 ? Math.max(0, Math.floor(margenLibre / diasRestantes)) : 0,
  }
}

interface Formato {
  moneda: string
  locale: string
}

function dinero(centavos: number, f: Formato): string {
  return formatearMoneda(centavos, f.moneda, f.locale)
}

/**
 * El semáforo. Con `monto` en cero devuelve la lectura general del mes, que es
 * lo que muestra el tablero; con un monto responde a "¿puedo gastar esto?".
 *
 * Cada regla aporta su propia razón y el veredicto se queda con la peor. Las
 * razones importan tanto como el color: un rojo sin explicación no cambia el
 * comportamiento de nadie.
 */
export function evaluarGasto(
  monto: number,
  categoriaId: string | null,
  ctx: ContextoFinanciero,
): Veredicto {
  const f = { moneda: ctx.ajustes.moneda, locale: ctx.ajustes.locale }
  const umbral = ctx.ajustes.umbralPrecaucion
  const margen = calcularMargen(ctx)
  const delPeriodo = transaccionesDelPeriodo(ctx.transacciones, ctx.periodo)
  const vigentes = presupuestosDelPeriodo(ctx.presupuestos, ctx.periodo)
  const razones: Razon[] = []
  const simulacion = monto > 0

  // 1. Presupuesto de la categoría del gasto.
  if (categoriaId) {
    const presupuesto = vigentes.find((p) => p.categoriaId === categoriaId)
    if (presupuesto) {
      const nombre = ctx.categorias.find((c) => c.id === categoriaId)?.nombre ?? 'esta categoría'
      const gastado = sumar(
        delPeriodo.filter((t) => t.tipo === 'egreso' && t.categoriaId === categoriaId).map((t) => t.monto),
      )
      const restante = presupuesto.montoLimite - gastado
      const consumo = fraccion(gastado + monto, presupuesto.montoLimite)

      if (monto > restante) {
        razones.push({
          clave: 'presupuesto-categoria',
          nivel: 'rojo',
          texto: simulacion
            ? `Te pasas ${dinero(monto - restante, f)} del presupuesto de ${nombre}.`
            : `Ya te pasaste ${dinero(-restante, f)} del presupuesto de ${nombre}.`,
        })
      } else if (consumo >= umbral) {
        razones.push({
          clave: 'presupuesto-categoria',
          nivel: 'ambar',
          texto: `${simulacion ? 'Con esto llevarías' : 'Llevas'} ${formatearPorcentaje(consumo, f.locale)} del presupuesto de ${nombre}.`,
        })
      } else {
        razones.push({
          clave: 'presupuesto-categoria',
          nivel: 'verde',
          texto: `Te quedan ${dinero(restante - monto, f)} de ${nombre} este mes.`,
        })
      }
    }
  }

  // 2. Presupuesto global del mes, si existe. Ojo: este tope es mensual, así
  //    que se mide contra el gasto del mes completo y no contra el del ciclo.
  const global = vigentes.find((p) => p.categoriaId === null)
  if (global) {
    const egresosDelMes = totalPorTipo(delPeriodo, 'egreso')
    const restante = global.montoLimite - egresosDelMes
    const consumo = fraccion(egresosDelMes + monto, global.montoLimite)
    if (monto > restante) {
      razones.push({
        clave: 'presupuesto-global',
        nivel: 'rojo',
        texto: simulacion
          ? `Rebasas tu tope de gasto del mes por ${dinero(monto - restante, f)}.`
          : `Rebasaste tu tope de gasto del mes por ${dinero(-restante, f)}.`,
      })
    } else if (consumo >= umbral) {
      razones.push({
        clave: 'presupuesto-global',
        nivel: 'ambar',
        texto: `${simulacion ? 'Quedarías en' : 'Vas en'} ${formatearPorcentaje(consumo, f.locale)} de tu tope de gasto del mes.`,
      })
    }
  }

  // 3. El margen libre: lo que queda después de deudas y metas.
  const margenDespues = margen.margenLibre - monto
  const ventana = esteCiclo(margen.ciclo.tipo)
  const restoDel = margen.ciclo.tipo === 'mensual' ? 'del mes' : `de ${ventana.replace('esta ', 'la ')}`
  if (margen.ingresos === 0) {
    razones.push({
      clave: 'sin-ingresos',
      nivel: 'ambar',
      texto: `Aún no registras ingresos, así que no puedo medir tu margen ${ventana}.`,
    })
  } else if (margenDespues < 0) {
    const comeDeudas = margenDespues + margen.compromisoMeta < 0
    if (comeDeudas && margen.compromisoDeuda > 0) {
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Te quedarías ${dinero(-margenDespues, f)} corto para los pagos de deuda que vienen.`
          : `Te faltan ${dinero(-margenDespues, f)} para cubrir los pagos de deuda que vienen.`,
      })
    } else if (margen.compromisoMeta > 0) {
      const afectado = dinero(Math.min(-margenDespues, margen.compromisoMeta), f)
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Sacrificas ${afectado} del aporte a tus metas ${ventana}.`
          : `Te faltan ${afectado} para el aporte a tus metas ${ventana}.`,
      })
    } else {
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Este gasto te deja ${dinero(-margenDespues, f)} en números rojos.`
          : `Vas ${dinero(-margenDespues, f)} en números rojos ${ventana}.`,
      })
    }
  } else if (margen.margenLibre > 0 && monto > margen.margenLibre * umbral) {
    razones.push({
      clave: 'margen',
      nivel: 'ambar',
      texto: `Te quedarían ${dinero(margenDespues, f)} libres para el resto ${restoDel}.`,
    })
  } else if (simulacion) {
    razones.push({
      clave: 'margen',
      nivel: 'verde',
      texto: `Te quedan ${dinero(margenDespues, f)} libres después de este gasto.`,
    })
  }

  // 4. Vencimientos cercanos: contexto que el usuario necesita ver aunque todo
  //    lo demás salga en verde.
  const vencimientos = proximosVencimientos(ctx.deudas, ctx.hoy, ctx.ajustes.diasAvisoVencimiento)
  if (vencimientos.length > 0) {
    const v = vencimientos[0]
    const cuando = v.vencido ? `venció hace ${Math.abs(v.dias)} días` : v.dias === 0 ? 'vence hoy' : `vence en ${v.dias} días`
    razones.push({
      clave: 'vencimiento',
      nivel: v.vencido ? 'rojo' : 'ambar',
      texto: `${dinero(v.monto, f)} a ${v.deuda.acreedor} ${cuando}.`,
    })
  }

  // 5. Metas en riesgo por culpa de este gasto.
  if (simulacion && margen.compromisoMeta > 0 && margenDespues >= 0 && margenDespues < margen.compromisoMeta) {
    razones.push({
      clave: 'meta',
      nivel: 'ambar',
      texto: `Después de esto te quedaría justo para el aporte a tus metas.`,
    })
  }

  return {
    nivel: peorNivel(razones.map((r) => r.nivel)),
    razones,
    margenAntes: margen.margenLibre,
    margenDespues,
  }
}

export const ETIQUETA_NIVEL: Record<NivelAlerta, string> = {
  verde: 'Puedes gastarlo',
  ambar: 'Puedes, con cuidado',
  rojo: 'Mejor no',
}

export const ETIQUETA_NIVEL_GENERAL: Record<NivelAlerta, string> = {
  verde: 'Vas bien',
  ambar: 'Ojo con el ritmo',
  rojo: 'Estás comprometido',
}
