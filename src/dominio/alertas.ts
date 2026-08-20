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
import { enDias, periodoAnterior, periodoDe, ultimosPeriodos } from './fechas'
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
  /**
   * Inicio del ciclo en el que la persona respondió "todavía no cobro". Si
   * coincide con el ciclo en curso, el ingreso estimado deja de contar como
   * dinero gastable: ella misma confirmó que no está en la cuenta.
   */
  cicloSinCobrar?: string
}

/**
 * Dos magnitudes que no se pueden mezclar, y que antes vivían en un solo campo
 * `balance` que significaba una u otra según hubiera saldo declarado:
 *
 * - **Stock** (`dineroDisponible`, `colchonTotal`): dinero que existe, venga de
 *   donde venga, incluidos ahorros de meses pasados.
 * - **Flujo** (`flujoDelCiclo`, `margenLibre`): lo que entró menos lo que salió
 *   dentro de esta ventana de cobro.
 *
 * Todo lo que se reparte entre días sale del flujo. Repartir el stock invitaba
 * a gastarse los ahorros de meses en los tres días que quedan de la quincena.
 */
export interface Margen {
  /** Ventana sobre la que se calculó todo: mes, quincena o semana. */
  ciclo: Ciclo
  /** Lo que se usa para calcular: real si lo hay, estimado si no. */
  ingresos: number
  /** Lo que de verdad entró y está registrado. Nunca una estimación. */
  ingresosReales: number
  egresos: number
  /** FLUJO: ingresos menos egresos del ciclo. */
  flujoDelCiclo: number
  /** STOCK: dinero que hay ahora. `null` si no se declaró saldo. */
  dineroDisponible: number | null
  /** Pagos de deuda que vencen antes de que cierre el ciclo. */
  compromisoDeuda: number
  /** La parte del aporte a metas que toca a este ciclo. */
  compromisoMeta: number
  /** FLUJO menos compromisos. Es una proyección: cuenta el cobro que falta. */
  margenLibre: number
  /** STOCK menos compromisos: el respaldo real. `null` sin saldo declarado. */
  colchonTotal: number | null
  /**
   * Lo que de verdad se puede gastar: el mínimo entre el flujo y el colchón.
   * Es la única cifra que debe llegar a la interfaz cuando la pregunta es
   * "¿puedo gastar esto?"; las otras dos son insumos suyos.
   */
  margenDisponible: number
  /** El disponible lo limita la cuenta y no la proyección del ciclo. */
  limitadoPorSaldo: boolean
  /** La persona respondió que su cobro de este ciclo todavía no cae. */
  cobroPendiente: boolean
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

  // El margen que se reparte entre días sale SIEMPRE del flujo del ciclo. El
  // saldo declarado no entra aquí: es un stock, y dividir ahorros de meses
  // entre los días que quedan de la quincena es un mal consejo.
  const flujoDelCiclo = ingresos - egresos
  const margenLibre = flujoDelCiclo - compromisoDeuda - compromisoMeta

  // El dinero que existe va por su cuenta, como respaldo y como contexto.
  const dineroDisponible = saldo.declarado ? saldo.actual : null
  const colchonTotal = saldo.declarado ? saldo.actual - compromisoDeuda - compromisoMeta : null

  const diasRestantes = esMesActual ? ciclo.diasRestantes : 0

  // "¿Cuánto puedo gastar?" tiene dos respuestas y hay que quedarse con la
  // más chica. El flujo es una proyección: cuenta el sueldo del ciclo aunque
  // todavía no haya caído. El colchón es lo que hay en la cuenta hoy. Antes
  // del cobro manda el colchón, y prometer el flujo ahí es prometer dinero
  // que no ha llegado.
  //
  // El mínimo se calcula UNA vez, aquí, y de aquí lo lee toda la app. Cuando
  // vivía escondido dentro de `evaluarGasto`, el tablero seguía repartiendo
  // el flujo y salían ecuaciones que no cuadran: "$6,500 libres ÷ 12 días =
  // $0 al día". Sin saldo declarado no hay colchón y el flujo es el único
  // dato disponible, que era el comportamiento histórico.
  // Y hay un tercer dato, el más directo de todos: que la persona haya dicho
  // "todavía no cobro". El tablero se lo pregunta, y esa respuesta solo servía
  // para esconder la tarjeta. Es información, y este es su lugar: un sueldo
  // que ella confirmó que no ha llegado no se puede gastar hoy. Si después lo
  // registra, `ingresosReales` deja de ser cero y la respuesta caduca sola.
  const cobroPendiente = ingresosReales === 0 && ctx.cicloSinCobrar === ciclo.inicio

  // Con saldo declarado la cuenta es la autoridad y basta cruzarla con el
  // flujo: ella ya refleja que el cobro no ha caído, y quien tiene $27 en el
  // banco puede gastar $27 aunque no haya cobrado. Decirle que tiene cero
  // sería la misma clase de mentira, nada más al revés.
  //
  // Sin saldo declarado no hay con qué contrastar la proyección, y ahí sí pesa
  // la respuesta: si dijo que todavía no cobra, el estimado no se reparte.
  const margenDisponible =
    colchonTotal !== null
      ? Math.min(margenLibre, colchonTotal)
      : cobroPendiente
        ? ingresosReales - egresos - compromisoDeuda - compromisoMeta
        : margenLibre
  const limitadoPorSaldo = colchonTotal !== null && colchonTotal < margenLibre

  const gastoDiarioSugerido =
    diasRestantes > 0 ? Math.max(0, Math.floor(margenDisponible / diasRestantes)) : 0

  return {
    ciclo,
    ingresos,
    ingresosReales,
    egresos,
    saldo,
    flujoDelCiclo,
    dineroDisponible,
    compromisoDeuda,
    compromisoMeta,
    margenLibre,
    colchonTotal,
    margenDisponible,
    limitadoPorSaldo,
    cobroPendiente,
    ingresosEstimados: ingresosReales === 0 && estimado > 0,
    diasRestantes,
    gastoDiarioSugerido,
  }
}

interface Formato {
  moneda: string
  locale: string
}

/**
 * Sin centavos, igual que en el resto de la interfaz. Las razones acompañan a
 * la cifra grande del medidor, que va redondeada: leer "$1,830" arriba y
 * "$1,830.00" justo debajo se ve como dos cuentas distintas. Los centavos
 * siguen intactos por dentro; esto es solo cómo se enseña.
 */
function dinero(centavos: number, f: Formato): string {
  return formatearMoneda(centavos, f.moneda, f.locale, { conDecimales: false })
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

  // 3. El margen: lo que queda después de deudas y metas.
  //
  // `margenDisponible` ya trae el mínimo entre el flujo del ciclo y el dinero
  // real de la cuenta. Aquí solo se le resta el gasto que se está evaluando.
  // Decir "te quedan $6,300 libres" con $27 en el banco era el bug de origen.
  const margenRealDespues = margen.margenDisponible - monto
  // La proyección sobra respecto de lo gastable por una de dos razones: la
  // cuenta topa, o el cobro que la sostiene todavía no cae.
  const flujoEsBinding = margen.margenDisponible >= margen.margenLibre
  const ventana = esteCiclo(margen.ciclo.tipo)
  const restoDel = margen.ciclo.tipo === 'mensual' ? 'del mes' : `de ${ventana.replace('esta ', 'la ')}`

  if (margen.ingresos === 0) {
    razones.push({
      clave: 'sin-ingresos',
      nivel: 'ambar',
      texto: `Aún no registras ingresos, así que no puedo medir tu margen ${ventana}.`,
    })
  } else if (margenRealDespues < 0) {
    const faltante = -margenRealDespues
    // El binding manda para decidir si el faltante lo cubre el colchón o no.
    const loCubreElAhorro = !flujoEsBinding || (margen.colchonTotal !== null && margen.colchonTotal >= faltante)
    const comeDeudas = margenRealDespues + margen.compromisoMeta < 0
    if (loCubreElAhorro && !flujoEsBinding) {
      // El flujo dice que alcanza, pero el binding (tu cuenta) no. Decirlo
      // claro en lugar de decir "saldrían de tu ahorro" — el binding ya ES
      // tu cuenta, no una proyección.
      const cobro = margen.ciclo.tipo === 'mensual' ? 'tu sueldo' : `tu ${margen.ciclo.nombre}`
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        // Sin saldo declarado no hay "cuenta" de la que hablar: lo único que
        // se sabe es que el cobro no ha caído, y eso es lo que hay que decir.
        texto:
          margen.dineroDisponible === null
            ? `Dijiste que ${cobro} todavía no cae, así que no hay con qué cubrir ${simulacion ? 'este gasto' : 'lo que llevas'}.`
            : simulacion
              ? `Te faltan ${dinero(faltante, f)} en tu cuenta para este gasto. ${cobro[0].toUpperCase()}${cobro.slice(1)} aún no cae.`
              : `Te faltan ${dinero(faltante, f)} en tu cuenta para lo que queda ${restoDel}.`,
      })
    } else if (loCubreElAhorro) {
      razones.push({
        clave: 'margen',
        nivel: 'ambar',
        texto: simulacion
          ? `Con esto gastas ${dinero(faltante, f)} más de lo que entró ${ventana}: saldrían de tu ahorro.`
          : `Llevas ${dinero(faltante, f)} más de lo que entró ${ventana}; estás tirando de tu ahorro.`,
      })
    } else if (comeDeudas && margen.compromisoDeuda > 0) {
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Te quedarías ${dinero(-margenRealDespues, f)} corto para los pagos de deuda que vienen.`
          : `Te faltan ${dinero(-margenRealDespues, f)} para cubrir los pagos de deuda que vienen.`,
      })
    } else if (margen.compromisoMeta > 0) {
      const afectado = dinero(Math.min(-margenRealDespues, margen.compromisoMeta), f)
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
          ? `Este gasto te deja ${dinero(-margenRealDespues, f)} en números rojos.`
          : `Vas ${dinero(-margenRealDespues, f)} en números rojos ${ventana}.`,
      })
    }
  } else if (margen.margenDisponible > 0 && monto > margen.margenDisponible * umbral) {
    // El umbral se mide contra el disponible: gastar el 90% de lo que hay en
    // la cuenta merece aviso aunque sea el 9% del sueldo que va a caer.
    razones.push({
      clave: 'margen',
      nivel: 'ambar',
      texto: margen.limitadoPorSaldo
        ? `Te quedarían ${dinero(margenRealDespues, f)} en la cuenta: casi todo lo que tienes hoy.`
        : `Te quedarían ${dinero(margenRealDespues, f)} libres para el resto ${restoDel}.`,
    })
  } else if (simulacion) {
    // Caso típico del usuario: declaró $21 de saldo, la quincena aún no cae,
    // el flujo del ciclo dice que tiene $6,300 pero la cuenta solo trae $21.
    // El flujo era una proyección; lo que cuenta HOY es el binding.
    if (!flujoEsBinding) {
      const enCuenta = margen.dineroDisponible!
      const enCuentaDespues = enCuenta - monto
      razones.push({
        clave: 'margen',
        nivel: 'verde',
        texto: `Tu cuenta queda en ${dinero(enCuentaDespues, f)} tras este gasto. Hoy partes de ${dinero(enCuenta, f)}: este margen sale de lo que ya tienes, no de lo que va a entrar.`,
      })
    } else {
      razones.push({
        clave: 'margen',
        nivel: 'verde',
        texto: `Te quedan ${dinero(margenRealDespues, f)} libres después de este gasto.`,
      })
    }
  }

  // 4. Vencimientos cercanos: contexto que el usuario necesita ver aunque todo
  //    lo demás salga en verde.
  const vencimientos = proximosVencimientos(ctx.deudas, ctx.hoy, ctx.ajustes.diasAvisoVencimiento)
  if (vencimientos.length > 0) {
    const v = vencimientos[0]
    const cuando = v.vencido
      ? `venció hace ${enDias(Math.abs(v.dias))}`
      : v.dias === 0
        ? 'vence hoy'
        : `vence en ${enDias(v.dias)}`
    razones.push({
      clave: 'vencimiento',
      nivel: v.vencido ? 'rojo' : 'ambar',
      texto: `${dinero(v.monto, f)} a ${v.deuda.acreedor} ${cuando}.`,
    })
  }

  // 5. Metas en riesgo por culpa de este gasto.
  if (
    simulacion &&
    margen.compromisoMeta > 0 &&
    margenRealDespues >= 0 &&
    margenRealDespues < margen.compromisoMeta
  ) {
    razones.push({
      clave: 'meta',
      nivel: 'ambar',
      texto: `Después de esto te quedaría justo para el aporte a tus metas.`,
    })
  }

  return {
    nivel: peorNivel(razones.map((r) => r.nivel)),
    razones,
    // Los dos son el disponible: antes y después del gasto. Cuando `antes`
    // era el flujo y `después` el binding, la resta que veía el usuario no
    // cuadraba con ninguna de las dos cifras.
    margenAntes: margen.margenDisponible,
    margenDespues: margenRealDespues,
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
