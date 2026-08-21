import type {
  AporteMeta,
  Ajustes,
  Categoria,
  Deuda,
  GastoRecurrente,
  Meta,
  NivelAlerta,
  PagoDeuda,
  Presupuesto,
  Razon,
  Transaccion,
  Veredicto,
} from './tipos'
import { formatearMoneda, formatearPorcentaje, fraccion, sumar } from './dinero'
import { diasEntre, enDias, periodoAnterior, periodoDe, ultimosPeriodos } from './fechas'
import { cicloDe, esteCiclo, type Ciclo } from './ciclos'
import { compromisoDeudas, proximosVencimientos } from './deudas'
import { compromisoMetas } from './metas'
import { egresosFijosPendientes, ingresosProgramados } from './recurrentes'
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
   * Plantillas de gasto e ingreso fijo. Opcional para que el dominio se pueda
   * probar sin ellas, pero cuando están cambian el resultado: son compromisos
   * con fecha y monto, no estimaciones.
   */
  recurrentes?: GastoRecurrente[]
  /**
   * Inicio del ciclo en el que la persona respondió "todavía no cobro". Si
   * coincide con el ciclo en curso, el ingreso estimado deja de contar como
   * dinero gastable: ella misma confirmó que no está en la cuenta.
   */
  cicloSinCobrar?: string
}

/**
 * Qué le pone el techo a lo que se puede gastar hoy. Son tres restricciones
 * distintas y confundirlas es lo que hacía que los números no cuadraran:
 *
 * - `caja`: no puedes gastar dinero que no está en la cuenta. Es liquidez.
 * - `compromisos`: puedes gastarlo, pero entonces no alcanza para lo que ya
 *   tiene dueño antes de que cierre el ciclo. Es solvencia.
 * - `flujo`: alcanza y sobra, pero gastarlo sería comerte el ahorro de meses
 *   pasados en los días que quedan de esta quincena. Es prudencia.
 */
export type Tope = 'caja' | 'compromisos' | 'flujo'

/**
 * Las tres magnitudes de una cuenta personal, que antes vivían mezcladas:
 *
 * - **Caja** (`efectivoHoy`): el dinero que existe ahora mismo. Es un saldo,
 *   una foto.
 * - **Flujo** (`flujoDelCiclo`, `margenLibre`): lo que entró menos lo que
 *   salió dentro de esta ventana de cobro. Es una película.
 * - **Compromisos** (`comprometido`): salidas que ya se contrajeron y todavía
 *   no ocurren. No son gasto todavía, pero ese dinero ya tiene dueño.
 *
 * La cifra que preside el tablero, `margenDisponible`, es la más restrictiva
 * de las tres. Restar los compromisos de la caja y llamar al resultado "lo
 * que te queda en la cuenta" era el error de origen: alguien con $27 y una
 * deuda de $5,173 leía "-$5,146 te quedarían en la cuenta" cuando en la
 * cuenta tenía $27 y el pago se iba a cubrir con la quincena que faltaba.
 */
export interface Margen {
  /** Ventana sobre la que se calculó todo: mes, quincena o semana. */
  ciclo: Ciclo

  // ── Flujo del ciclo ──────────────────────────────────────────────────
  /** Ingreso del ciclo: lo registrado más lo que falta por caer. */
  ingresos: number
  /** Lo que de verdad entró y está registrado. Nunca una estimación. */
  ingresosReales: number
  egresos: number
  /** FLUJO: ingresos menos egresos del ciclo. */
  flujoDelCiclo: number

  // ── Caja ─────────────────────────────────────────────────────────────
  /** El dinero real, si la persona declaró su saldo. */
  saldo: Saldo
  /** Lo que hay HOY en la cuenta. `null` si no se declaró saldo. */
  efectivoHoy: number | null
  /** Alias histórico de `efectivoHoy`, que usan tablero y gráficas. */
  dineroDisponible: number | null
  /** Ingreso del ciclo que todavía no cae. Cero si ya cayó. */
  porEntrar: number
  /** Cuándo cae. Solo se sabe con una plantilla de ingreso recurrente. */
  fechaProximoCobro: string | null

  // ── Compromisos ──────────────────────────────────────────────────────
  /** Pagos de deuda que vencen antes de que cierre el ciclo. */
  compromisoDeuda: number
  /** La parte del aporte a metas que toca a este ciclo. */
  compromisoMeta: number
  /** Gastos fijos con plantilla que aún no se cobran en este ciclo. */
  compromisoRecurrente: number
  /** Suma de los tres: el dinero del ciclo que ya tiene dueño. */
  comprometido: number
  /**
   * Pagos que caen DESPUÉS del cierre, dentro de la ventana de aviso. Son
   * contexto y no se restan: los cubre el cobro siguiente, no el dinero de
   * hoy. Restarlos aquí es lo que hundía el margen sin razón.
   */
  comprometidoDespues: number

  // ── Resultados ───────────────────────────────────────────────────────
  /** FLUJO menos compromisos. Proyección: cuenta el cobro que falta. */
  margenLibre: number
  /** CAJA menos compromisos. Negativo = el cobro que falta es imprescindible. */
  colchonTotal: number | null
  /** Con qué se cierra el ciclo: caja + lo que entra − lo comprometido. */
  proyeccionCierre: number | null
  /**
   * Lo que de verdad se puede gastar hoy: el más chico de los tres topes.
   * Es la única cifra que debe llegar a la interfaz cuando la pregunta es
   * "¿puedo gastar esto?"; las otras son insumos suyos.
   */
  margenDisponible: number
  /** Cuál de los tres topes está mandando. */
  tope: Tope
  /** El disponible lo limita la cuenta y no la proyección del ciclo. */
  limitadoPorSaldo: boolean
  /** La persona respondió que su cobro de este ciclo todavía no cae. */
  cobroPendiente: boolean
  /** Los ingresos del ciclo aún no aparecen y se estimó con otra fuente. */
  ingresosEstimados: boolean
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
  const recurrentes = ctx.recurrentes ?? []

  const enCiclo = ctx.transacciones.filter((t) => t.fecha >= ciclo.inicio && t.fecha <= ciclo.fin)
  const ingresosReales = totalPorTipo(enCiclo, 'ingreso')
  const egresos = totalPorTipo(enCiclo, 'egreso')

  // ── Lo que falta por entrar ──────────────────────────────────────────
  //
  // Orden de confianza, de mejor a peor:
  //   1. una plantilla de ingreso recurrente: dice cuánto Y qué día;
  //   2. la parte del sueldo configurado que le toca al ciclo;
  //   3. el promedio histórico repartido igual.
  //
  // Las dos últimas son estimaciones y la app las nombra como tales.
  const programado = ingresosProgramados(recurrentes, ctx.hoy, ciclo.fin)
  const mensualEstimado =
    ctx.ajustes.ingresoMensual > 0
      ? ctx.ajustes.ingresoMensual
      : ingresoTipico(ctx.transacciones, ctx.periodo)
  const estimado = ingresosReales === 0 ? Math.round(mensualEstimado / ciclo.porMes) : 0
  const porEntrar = programado.total > 0 ? programado.total : estimado
  // Devengado: lo que el ciclo va a producir, esté o no depositado.
  const ingresos = ingresosReales + porEntrar

  // ── Compromisos ──────────────────────────────────────────────────────
  //
  // Solo lo que vence ANTES de que cierre el ciclo. Un pago que cae después
  // del cierre lo cubre el cobro siguiente, no el dinero de hoy: restarlo
  // aquí hundía el margen por algo que ya tenía con qué pagarse. Sigue
  // avisándose, pero como contexto (`comprometidoDespues`).
  const diasHastaCierre = Math.max(0, diasEntre(ctx.hoy, ciclo.fin))
  const compromisoDeuda = compromisoDeudas(ctx.deudas, ctx.hoy, diasHastaCierre)
  const ventanaAviso = Math.max(diasHastaCierre, ctx.ajustes.diasAvisoVencimiento)
  const comprometidoDespues =
    compromisoDeudas(ctx.deudas, ctx.hoy, ventanaAviso) - compromisoDeuda

  // El aporte a metas es mensual; a este ciclo le toca su parte proporcional
  // de lo que aún falta apartar en el mes.
  const pendienteMes = compromisoMetas(ctx.metas, ctx.aportes, ctx.periodo)
  const compromisoMeta = Math.ceil(pendienteMes / ciclo.restantesEnMes)

  // Los gastos fijos que todavía no se cobran son salida segura.
  const compromisoRecurrente = egresosFijosPendientes(recurrentes, ctx.hoy, ciclo.fin)

  const comprometido = compromisoDeuda + compromisoMeta + compromisoRecurrente

  const saldo = calcularSaldo(
    ctx.ajustes.saldoInicial,
    ctx.ajustes.saldoInicialFecha,
    ctx.transacciones,
    ctx.pagos,
    ctx.aportes,
  )

  const flujoDelCiclo = ingresos - egresos
  const margenLibre = flujoDelCiclo - comprometido

  const efectivoHoy = saldo.declarado ? saldo.actual : null
  const colchonTotal = efectivoHoy === null ? null : efectivoHoy - comprometido
  const proyeccionCierre = efectivoHoy === null ? null : efectivoHoy + porEntrar - comprometido

  const diasRestantes = esMesActual ? ciclo.diasRestantes : 0

  // La persona dijo "todavía no cobro". Es información, no solo un botón para
  // esconder una tarjeta: un sueldo que ella confirmó que no ha llegado no se
  // puede gastar hoy. Si después lo registra, `ingresosReales` deja de ser
  // cero y la respuesta caduca sola.
  const cobroPendiente = ingresosReales === 0 && ctx.cicloSinCobrar === ciclo.inicio

  // ── El techo ─────────────────────────────────────────────────────────
  //
  // Con saldo declarado se eligen las tres restricciones y gana la más
  // apretada. El flujo solo compite cuando el ciclo cierra en positivo: si
  // el ciclo ya viene corto, "lo que entró menos lo que salió" deja de ser
  // una respuesta a "¿cuánto puedo gastar?" y quien contesta es la caja.
  let margenDisponible: number
  let tope: Tope = 'flujo'
  if (efectivoHoy !== null && proyeccionCierre !== null) {
    const candidatos: Array<[Tope, number]> = [
      ['flujo', margenLibre],
      ['caja', efectivoHoy],
      ['compromisos', proyeccionCierre],
    ]
    const ganador = candidatos.reduce((a, b) => (b[1] < a[1] ? b : a))
    tope = ganador[0]
    margenDisponible = ganador[1]
  } else if (cobroPendiente) {
    // Sin saldo declarado no hay caja con qué contrastar la proyección, y ahí
    // sí pesa la respuesta: si dijo que todavía no cobra, lo estimado no se
    // reparte.
    margenDisponible = ingresosReales - egresos - comprometido
  } else {
    margenDisponible = margenLibre
  }

  const gastoDiarioSugerido =
    diasRestantes > 0 ? Math.max(0, Math.floor(margenDisponible / diasRestantes)) : 0

  return {
    ciclo,
    ingresos,
    ingresosReales,
    egresos,
    saldo,
    flujoDelCiclo,
    efectivoHoy,
    dineroDisponible: efectivoHoy,
    porEntrar,
    fechaProximoCobro: programado.fecha,
    compromisoDeuda,
    compromisoMeta,
    compromisoRecurrente,
    comprometido,
    comprometidoDespues,
    margenLibre,
    colchonTotal,
    proyeccionCierre,
    margenDisponible,
    tope,
    limitadoPorSaldo: tope === 'caja' && efectivoHoy !== null,
    cobroPendiente,
    ingresosEstimados: ingresosReales === 0 && porEntrar > 0,
    diasRestantes,
    gastoDiarioSugerido,
  }
}

interface Formato {
  moneda: string
  locale: string
}

/**
 * Los centavos aparecen solo si existen. Las razones acompañan a la cifra
 * grande del medidor, y leer "$1,830" arriba y "$1,830.00" debajo se ve como
 * dos cuentas distintas; pero redondear $3.50 a $4 es inventar medio peso
 * justo en la frase que dice cuánto le falta a alguien.
 */
function dinero(centavos: number, f: Formato): string {
  return formatearMoneda(centavos, f.moneda, f.locale, { conDecimales: 'auto' })
}

/** "tu quincena" / "tu semana" / "tu sueldo": el cobro nombrado por su ciclo. */
function nombreCobro(ciclo: Ciclo): string {
  return ciclo.tipo === 'mensual' ? 'tu sueldo' : `tu ${ciclo.nombre}`
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * El semáforo. Con `monto` en cero devuelve la lectura general del ciclo, que
 * es lo que muestra el tablero; con un monto responde a "¿puedo gastar esto?".
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

  // 3. Liquidez, solvencia y prudencia — en ese orden, que es el orden en que
  //    a una persona se le rompen las cosas.
  const disponibleDespues = margen.margenDisponible - monto
  const efectivoDespues = margen.efectivoHoy === null ? null : margen.efectivoHoy - monto
  const ventana = esteCiclo(margen.ciclo.tipo)
  const restoDel = margen.ciclo.tipo === 'mensual' ? 'del mes' : `de ${ventana.replace('esta ', 'la ')}`
  const cobro = nombreCobro(margen.ciclo)
  const faltaElCobro = margen.cobroPendiente || margen.ingresosEstimados

  if (margen.ingresos === 0) {
    razones.push({
      clave: 'sin-ingresos',
      nivel: 'ambar',
      texto: `Aún no registras ingresos, así que no puedo medir tu margen ${ventana}.`,
    })
  } else if (efectivoDespues !== null && efectivoDespues < 0) {
    // LIQUIDEZ. El dinero no está. Da igual lo que diga la proyección del
    // ciclo: no se puede pagar con un depósito que todavía no llega.
    //
    // Esta rama es la corrección del bug de origen. Antes se restaban los
    // compromisos del efectivo y se anunciaba el resultado como saldo de la
    // cuenta: con $27 en el banco y una deuda de $5,173 por vencer, un gasto
    // de $200 decía "te faltan $5,346 en tu cuenta". Faltaban $173. Los otros
    // $5,173 eran un pago que se iba a cubrir con la quincena, y mezclarlos
    // convertía un aviso correcto en una cifra que nadie reconoce.
    razones.push({
      clave: 'margen',
      nivel: 'rojo',
      texto: simulacion
        ? `Te faltan ${dinero(-efectivoDespues, f)}: en la cuenta tienes ${dinero(margen.efectivoHoy!, f)} y esto cuesta ${dinero(monto, f)}.${faltaElCobro ? ` ${mayuscula(cobro)} todavía no cae.` : ''}`
        : `Tu cuenta está en ${dinero(margen.efectivoHoy!, f)}.`,
    })
  } else if (margen.cobroPendiente && margen.efectivoHoy === null && disponibleDespues < 0) {
    // Sin saldo declarado lo único que se sabe es lo que ella misma contestó.
    razones.push({
      clave: 'margen',
      nivel: 'rojo',
      texto: `Dijiste que ${cobro} todavía no cae, así que no hay con qué cubrir ${simulacion ? 'este gasto' : 'lo que llevas'}.`,
    })
  } else if (disponibleDespues < 0) {
    const faltante = -disponibleDespues
    // Lo que se sacrifica tiene un orden: el aporte a metas es la parte
    // flexible del compromiso —posponerlo cuesta tiempo, no un recargo—; el
    // pago de deuda y el gasto fijo son rígidos y fallarlos cuesta dinero.
    const flexible = margen.compromisoMeta
    const rigido = margen.compromisoDeuda + margen.compromisoRecurrente
    // Con el flujo mandando, el bajón sale del ahorro y no de un impago: eso
    // es un aviso, no una alarma. Si el techo lo pone la caja o los
    // compromisos, no hay ahorro del que tirar y el color tiene que decirlo.
    const loCubreElAhorro =
      margen.tope === 'flujo' && margen.colchonTotal !== null && margen.colchonTotal >= faltante

    if (loCubreElAhorro) {
      razones.push({
        clave: 'margen',
        nivel: 'ambar',
        texto: simulacion
          ? `Con esto gastas ${dinero(faltante, f)} más de lo que entró ${ventana}: saldrían de tu ahorro.`
          : `Llevas ${dinero(faltante, f)} más de lo que entró ${ventana}; estás tirando de tu ahorro.`,
      })
    } else if (flexible > 0 && faltante <= flexible) {
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Sacrificas ${dinero(faltante, f)} del aporte a tus metas ${ventana}.`
          : `Te faltan ${dinero(faltante, f)} para el aporte a tus metas ${ventana}.`,
      })
    } else if (rigido > 0) {
      const que =
        margen.compromisoDeuda > 0
          ? 'los pagos de deuda que vienen'
          : 'tus gastos fijos de este ciclo'
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Te quedarías ${dinero(faltante, f)} corto para ${que}.`
          : `Te faltan ${dinero(faltante, f)} para cubrir ${que}.`,
      })
    } else {
      razones.push({
        clave: 'margen',
        nivel: 'rojo',
        texto: simulacion
          ? `Este gasto te deja ${dinero(faltante, f)} en números rojos.`
          : `Vas ${dinero(faltante, f)} en números rojos ${ventana}.`,
      })
    }
  } else if (margen.margenDisponible > 0 && monto > margen.margenDisponible * umbral) {
    // El umbral se mide contra el disponible: gastar el 90% de lo que hay en
    // la cuenta merece aviso aunque sea el 9% del sueldo que va a caer.
    razones.push({
      clave: 'margen',
      nivel: 'ambar',
      texto:
        margen.tope === 'caja'
          ? `Te quedarían ${dinero(efectivoDespues ?? disponibleDespues, f)} en la cuenta: casi todo lo que tienes hoy.`
          : `Te quedarían ${dinero(disponibleDespues, f)} libres para el resto ${restoDel}.`,
    })
  } else if (simulacion) {
    razones.push({
      clave: 'margen',
      nivel: 'verde',
      texto:
        margen.tope === 'caja' && efectivoDespues !== null
          ? `Te quedan ${dinero(efectivoDespues, f)} en la cuenta. Este margen sale de lo que ya tienes, no de lo que va a entrar.`
          : `Te quedan ${dinero(disponibleDespues, f)} libres después de este gasto.`,
    })
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
    disponibleDespues >= 0 &&
    disponibleDespues < margen.compromisoMeta
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
    // era el flujo y `después` la caja, la resta que veía el usuario no
    // cuadraba con ninguna de las dos cifras.
    margenAntes: margen.margenDisponible,
    margenDespues: disponibleDespues,
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
