import type { ContextoFinanciero } from './alertas'
import type { PagoDeuda } from './tipos'
import { calcularMargen } from './alertas'
import { formatearMoneda, sumar } from './dinero'
import { diasEntre, enDias, nombrePeriodo, periodoAnterior, ultimosPeriodos } from './fechas'
import { esteCiclo } from './ciclos'
import { formatearFechaCorta } from './fechas'
import {
  deudaPrioritaria,
  mesesAhorrados,
  obligacionMensual,
  proximosVencimientos,
  proyectarDeuda,
} from './deudas'
import { proyectarMeta } from './metas'
import { calcularSalud } from './salud'
import {
  gastoPorCategoria,
  presupuestosDelPeriodo,
  totalPorTipo,
  transaccionesDelPeriodo,
} from './presupuestos'

export type TipoRecomendacion = 'presupuesto' | 'deuda' | 'meta' | 'habito' | 'oportunidad'

export interface Recomendacion {
  id: string
  tipo: TipoRecomendacion
  /** 1 es lo más urgente. Ordena la lista. */
  prioridad: number
  titulo: string
  detalle: string
  icono: string
}

/** Cuántas transacciones chicas hacen falta para llamarlo gasto hormiga. */
const HORMIGA_MINIMO_MOVIMIENTOS = 8

/**
 * Los umbrales se miden contra el ingreso, no en pesos fijos.
 *
 * Antes estaban clavados: $150 era "gasto chico", $500 "dinero libre relevante",
 * $1,000 "categoría cara". Para quien cobra 8,500 a la quincena, $150 es un
 * gasto considerable; para quien cobra 50,000 al mes, es ruido. El mismo
 * movimiento tenía que clasificarse distinto según quién lo hizo.
 *
 * El piso absoluto existe para cuando no hay ingreso configurado ni historial:
 * sin él, todo umbral sería cero y la app marcaría cada centavo.
 */
const PROPORCION = {
  /** Un movimiento es "chico" por debajo de esta parte del ingreso mensual. */
  hormiga: 0.02,
  /** Sobrante que vale la pena redirigir a deuda o meta. */
  excedente: 0.05,
  /** Cuándo una categoría pesa lo bastante para simular un recorte. */
  categoriaCara: 0.1,
  /** Suscripciones que ya justifican revisarlas. */
  suscripciones: 0.02,
  /** Alza mínima del mes anterior que merece mención. */
  alzaBase: 0.05,
}

const PISO = {
  hormiga: 5_000,
  excedente: 20_000,
  categoriaCara: 40_000,
  suscripciones: 8_000,
  alzaBase: 20_000,
}

/**
 * Ingreso mensual de referencia: el configurado, y si no, lo que el ciclo
 * sugiere. Cero significa que no hay con qué escalar y mandan los pisos.
 */
function referenciaMensual(ctx: ContextoFinanciero, ingresosDelCiclo: number, porMes: number): number {
  if (ctx.ajustes.ingresoMensual > 0) return ctx.ajustes.ingresoMensual
  return Math.round(ingresosDelCiclo * porMes)
}

function umbral(clave: keyof typeof PROPORCION, referencia: number): number {
  return Math.max(PISO[clave], Math.round(referencia * PROPORCION[clave]))
}


/**
 * Las razones que un contador calcula antes de opinar.
 *
 * Un consejo que no viene de una proporción es una corazonada: "gastas mucho
 * en comida" no le dice nada a quien gana el triple. Estas cuatro son las
 * que deciden si una economía personal aguanta un mes malo, y las cuatro
 * tienen umbrales que no se inventaron aquí.
 */
export interface Indicadores {
  /** Ingreso mensual de referencia. Cero = no hay con qué medir. */
  ingresoMensual: number
  /** Gasto medio al mes, de los tres meses anteriores completos. */
  gastoMensual: number
  /**
   * Servicio de deuda sobre ingreso. La banca corta en 36% para dar crédito
   * y en 43% para una hipoteca; por encima de ahí el presupuesto ya no tiene
   * de dónde absorber un imprevisto.
   */
  cargaDeuda: number
  /**
   * Gasto fijo comprometido sobre ingreso: renta, servicios, suscripciones,
   * mensualidades. Por encima del 50% no queda margen que administrar.
   */
  cargaFija: number
  /** Lo que se aparta al mes sobre lo que entra. El piso sano es 10%. */
  tasaAhorro: number
  /** Meses de gasto que cubre el efectivo de hoy. Tres es el mínimo. */
  mesesDeColchon: number | null
}

export function calcularIndicadores(ctx: ContextoFinanciero): Indicadores {
  const margen = calcularMargen(ctx)
  const ingresoMensual = referenciaMensual(ctx, margen.ingresos, margen.ciclo.porMes)
  const gastoMensual = promedioEgresosMensuales(ctx)

  // Gasto fijo al mes: lo que cada plantilla activa cobra en un mes completo,
  // sin importar en qué punto del ciclo estemos hoy. La razón mide estructura,
  // no calendario.
  const mes = ctx.hoy.slice(0, 7)
  const gastoFijoMensual = sumar(
    (ctx.recurrentes ?? [])
      .filter((r) => r.activo && r.tipo === 'egreso')
      .filter((r) => {
        const fecha = `${mes}-${String(r.diaDelMes).padStart(2, '0')}`
        return fecha >= r.iniciaEn && (!r.terminaEn || fecha <= r.terminaEn)
      })
      .map((r) => r.monto),
  )

  const ahorroMensual = sumar(
    ctx.metas.filter((m) => !m.completada).map((m) => m.aporteMensual),
  )

  const razon = (parte: number) => (ingresoMensual > 0 ? parte / ingresoMensual : 0)

  return {
    ingresoMensual,
    gastoMensual,
    cargaDeuda: razon(obligacionMensual(ctx.deudas)),
    cargaFija: razon(gastoFijoMensual),
    tasaAhorro: razon(ahorroMensual),
    mesesDeColchon:
      margen.efectivoHoy === null || gastoMensual <= 0
        ? null
        : margen.efectivoHoy / gastoMensual,
  }
}

export function generarRecomendaciones(
  ctx: ContextoFinanciero,
  pagos: PagoDeuda[],
): Recomendacion[] {
  const f = { moneda: ctx.ajustes.moneda, locale: ctx.ajustes.locale }
  const dinero = (c: number) => formatearMoneda(c, f.moneda, f.locale, { conDecimales: 'auto' })
  const lista: Recomendacion[] = []
  const margen = calcularMargen(ctx)
  // Todos los umbrales de este archivo se escalan con esto.
  const referencia = referenciaMensual(ctx, margen.ingresos, margen.ciclo.porMes)

  // Categorías rebasadas varios meses seguidos: el presupuesto está mal puesto
  // o el hábito está mal, y en ambos casos hay que decirlo.
  const periodos = ultimosPeriodos(ctx.periodo, 3)
  const rachas = new Map<string, { nombre: string; meses: number; exceso: number }>()
  for (const periodo of periodos) {
    const delMes = transaccionesDelPeriodo(ctx.transacciones, periodo)
    const gastos = gastoPorCategoria(delMes)
    for (const p of presupuestosDelPeriodo(ctx.presupuestos, periodo)) {
      if (!p.categoriaId) continue
      const gastado = gastos.get(p.categoriaId) ?? 0
      if (gastado <= p.montoLimite) continue
      const nombre = ctx.categorias.find((c) => c.id === p.categoriaId)?.nombre ?? 'una categoría'
      const previo = rachas.get(p.categoriaId) ?? { nombre, meses: 0, exceso: 0 }
      rachas.set(p.categoriaId, {
        nombre,
        meses: previo.meses + 1,
        exceso: previo.exceso + (gastado - p.montoLimite),
      })
    }
  }
  for (const [id, racha] of rachas) {
    if (racha.meses < 2) continue
    lista.push({
      id: `racha-${id}`,
      tipo: 'presupuesto',
      prioridad: racha.meses >= 3 ? 1 : 3,
      titulo: `Llevas ${racha.meses} meses rebasando ${racha.nombre}`,
      detalle: `Te has pasado ${dinero(racha.exceso)} en total. O el presupuesto quedó corto o el gasto se salió de control; ajusta uno de los dos.`,
      icono: 'TrendingUp',
    })
  }

  // Deudas que con el pago actual no se acaban nunca.
  for (const deuda of ctx.deudas.filter((d) => !d.liquidada && d.saldoActual > 0)) {
    const proyeccion = proyectarDeuda(deuda, pagos, ctx.hoy)
    if (proyeccion.ahogada) {
      lista.push({
        id: `ahogada-${deuda.id}`,
        tipo: 'deuda',
        prioridad: 1,
        titulo: `${deuda.acreedor} no baja con lo que pagas`,
        detalle: `Al ritmo de ${dinero(proyeccion.ritmoUsado)} al mes, los intereses se comen el abono y el saldo nunca llega a cero. Necesitas subir el pago.`,
        icono: 'CircleAlert',
      })
    } else if (proyeccion.mesesRestantes !== null && proyeccion.mesesRestantes > 36) {
      lista.push({
        id: `larga-${deuda.id}`,
        tipo: 'deuda',
        prioridad: 4,
        titulo: `${deuda.acreedor} te llevará ${proyeccion.mesesRestantes} meses`,
        detalle: `Pagarías ${dinero(proyeccion.interesProyectado)} solo de intereses. Cualquier abono extra recorta esa cuenta.`,
        icono: 'Hourglass',
      })
    }
  }

  // Dinero libre del mes: a la deuda más cara, o a la meta más cercana.
  //
  // Se mide sobre el disponible, no sobre el flujo: mover dinero que todavía
  // no cae en la cuenta deja a la persona en descubierto justo cuando siguió
  // el consejo. Si el cobro aún no entra, no hay excedente que repartir.
  if (margen.margenDisponible > umbral('excedente', referencia)) {
    const objetivo = deudaPrioritaria(ctx.deudas)
    if (objetivo) {
      const proyeccion = proyectarDeuda(objetivo, pagos, ctx.hoy)
      const ahorrados = mesesAhorrados(objetivo, proyeccion.ritmoUsado, margen.margenDisponible)
      lista.push({
        id: 'excedente-deuda',
        tipo: 'oportunidad',
        prioridad: 2,
        titulo: `Tienes ${dinero(margen.margenDisponible)} libres este mes`,
        detalle: objetivo.tasaInteres
          ? `Abónalos a ${objetivo.acreedor} (${objetivo.tasaInteres}% anual, tu tasa más alta)${ahorrados > 0 ? ` y la liquidas ${ahorrados} ${ahorrados === 1 ? 'mes' : 'meses'} antes` : ''}.`
          : `Abónalos a ${objetivo.acreedor}, tu saldo más chico: quitártelo de encima libera ese pago mensual.`,
        icono: 'Sparkles',
      })
    } else {
      const cercana = [...ctx.metas]
        .filter((m) => !m.completada)
        .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))[0]
      if (cercana) {
        lista.push({
          id: 'excedente-meta',
          tipo: 'oportunidad',
          prioridad: 2,
          titulo: `Tienes ${dinero(margen.margenDisponible)} libres este mes`,
          detalle: `Sin deudas pendientes, el mejor destino es ${cercana.nombre}, tu meta más próxima a vencer.`,
          icono: 'Sparkles',
        })
      }
    }
  }

  // Metas que no llegan a tiempo con el ritmo actual.
  for (const meta of ctx.metas.filter((m) => !m.completada)) {
    const proyeccion = proyectarMeta(meta, ctx.aportes, ctx.hoy)
    if (!proyeccion.enRiesgo) continue
    lista.push({
      id: `meta-${meta.id}`,
      tipo: 'meta',
      prioridad: proyeccion.vencida ? 1 : 3,
      titulo: proyeccion.vencida
        ? `${meta.nombre} ya venció`
        : `${meta.nombre} no llega a tiempo`,
      detalle: `Te faltan ${dinero(proyeccion.faltante)}. Para cumplir necesitas apartar ${dinero(proyeccion.aporteNecesario)} al mes; ahora vas a ${dinero(proyeccion.ritmoMensual)}.`,
      icono: 'Target',
    })
  }

  // Gasto hormiga: muchos movimientos chicos que en total no son chicos.
  const delPeriodo = transaccionesDelPeriodo(ctx.transacciones, ctx.periodo)
  const porCategoria = new Map<string, { conteo: number; total: number }>()
  for (const t of delPeriodo) {
    if (t.tipo !== 'egreso' || t.monto > umbral('hormiga', referencia)) continue
    const previo = porCategoria.get(t.categoriaId) ?? { conteo: 0, total: 0 }
    porCategoria.set(t.categoriaId, { conteo: previo.conteo + 1, total: previo.total + t.monto })
  }
  for (const [id, datos] of porCategoria) {
    if (datos.conteo < HORMIGA_MINIMO_MOVIMIENTOS) continue
    const nombre = ctx.categorias.find((c) => c.id === id)?.nombre ?? 'una categoría'
    lista.push({
      id: `hormiga-${id}`,
      tipo: 'habito',
      prioridad: 5,
      titulo: `${datos.conteo} gastos chicos en ${nombre}`,
      detalle: `Suman ${dinero(datos.total)} este mes. Ninguno se siente caro por separado; juntos sí.`,
      icono: 'Coins',
    })
  }

  // Categorías que se dispararon contra el mes pasado.
  const anterior = periodoAnterior(ctx.periodo)
  const gastosActual = gastoPorCategoria(delPeriodo)
  const gastosAnterior = gastoPorCategoria(transaccionesDelPeriodo(ctx.transacciones, anterior))
  for (const [id, actual] of gastosActual) {
    const previo = gastosAnterior.get(id) ?? 0
    if (previo < umbral('alzaBase', referencia) || actual <= previo * 1.3) continue
    const nombre = ctx.categorias.find((c) => c.id === id)?.nombre ?? 'una categoría'
    const alza = Math.round(((actual - previo) / previo) * 100)
    lista.push({
      id: `alza-${id}`,
      tipo: 'habito',
      prioridad: 4,
      titulo: `${nombre} subió ${alza}% contra ${nombrePeriodo(anterior)}`,
      detalle: `Pasaste de ${dinero(previo)} a ${dinero(actual)}. Vale la pena revisar qué cambió.`,
      icono: 'ChartNoAxesColumnIncreasing',
    })
  }

  // Qué pasaría si recortas la categoría más cara y ese dinero va a la deuda.
  const objetivo = deudaPrioritaria(ctx.deudas)
  const masCara = [...gastosActual.entries()].sort((a, b) => b[1] - a[1])[0]
  if (objetivo && masCara && masCara[1] > umbral('categoriaCara', referencia)) {
    const recorte = Math.round(masCara[1] * 0.2)
    const proyeccion = proyectarDeuda(objetivo, pagos, ctx.hoy)
    const ahorrados = mesesAhorrados(objetivo, proyeccion.ritmoUsado, recorte)
    if (ahorrados > 0) {
      const nombre = ctx.categorias.find((c) => c.id === masCara[0])?.nombre ?? 'tu categoría más cara'
      lista.push({
        id: 'simulacion-recorte',
        tipo: 'oportunidad',
        prioridad: 3,
        titulo: `Recorta 20% en ${nombre} y liquidas ${objetivo.acreedor} ${ahorrados} ${ahorrados === 1 ? 'mes' : 'meses'} antes`,
        detalle: `Son ${dinero(recorte)} al mes redirigidos al saldo en vez de a los intereses.`,
        icono: 'Scissors',
      })
    }
  }

  // Ciclo cerrado en negativo.
  if (margen.flujoDelCiclo < 0 && margen.ingresos > 0) {
    lista.push({
      id: 'balance-negativo',
      tipo: 'presupuesto',
      prioridad: 1,
      titulo: `Gastaste ${dinero(-margen.flujoDelCiclo)} más de lo que entró`,
      detalle: `Estás sacando de ahorros o de crédito ${esteCiclo(margen.ciclo.tipo)}. Revisa las categorías de arriba primero.`,
      icono: 'TrendingDown',
    })
  }

  // El ritmo dentro del ciclo: gastar el 70% cuando va el 30% del tiempo es
  // el aviso más accionable que existe, porque todavía se puede corregir.
  if (margen.ciclo.diasRestantes > 0 && margen.ingresos > 0 && margen.flujoDelCiclo >= 0) {
    const diasCorridos = margen.ciclo.diasTotales - margen.ciclo.diasRestantes + 1
    const avanceTiempo = diasCorridos / margen.ciclo.diasTotales
    const avanceGasto = margen.ingresos > 0 ? margen.egresos / margen.ingresos : 0
    if (avanceGasto > avanceTiempo + 0.2) {
      lista.push({
        id: 'ritmo-ciclo',
        tipo: 'habito',
        prioridad: 2,
        titulo: `Vas gastando más rápido de lo que corre ${esteCiclo(margen.ciclo.tipo)}`,
        detalle: `Llevas ${Math.round(avanceGasto * 100)}% de tu ingreso gastado y solo ${Math.round(avanceTiempo * 100)}% del tiempo. Bajar a ${dinero(margen.gastoDiarioSugerido)} al día te endereza.`,
        icono: 'Hourglass',
      })
    }
  }

  // Suscripciones: baratas al mes, caras al año. Verlas anualizadas cambia
  // la decisión de quedarse o cancelarlas.
  const suscripciones = ctx.categorias.find((c) => c.nombre.toLowerCase().startsWith('suscripci'))
  if (suscripciones) {
    const alMes = gastosActual.get(suscripciones.id) ?? 0
    if (alMes > umbral('suscripciones', referencia)) {
      lista.push({
        id: 'suscripciones-anuales',
        tipo: 'habito',
        prioridad: 5,
        titulo: `Tus suscripciones son ${dinero(alMes * 12)} al año`,
        detalle: `Son ${dinero(alMes)} al mes que se van solos. Vale la pena revisar cuáles usaste de verdad este mes.`,
        icono: 'Repeat',
      })
    }
  }

  // Una categoría que ya pesa mucho y no tiene tope contra qué medirse.
  const conPresupuesto = new Set(
    presupuestosDelPeriodo(ctx.presupuestos, ctx.periodo).map((p) => p.categoriaId),
  )
  const totalEgresos = totalPorTipo(delPeriodo, 'egreso')
  for (const [id, gastado] of gastosActual) {
    if (conPresupuesto.has(id) || totalEgresos === 0) continue
    if (gastado / totalEgresos < 0.15) continue
    const nombre = ctx.categorias.find((c) => c.id === id)?.nombre ?? 'una categoría'
    lista.push({
      id: `sin-tope-${id}`,
      tipo: 'presupuesto',
      prioridad: 4,
      titulo: `${nombre} se lleva ${Math.round((gastado / totalEgresos) * 100)}% de tu gasto y no tiene tope`,
      detalle: `Van ${dinero(gastado)} este mes. Ponerle un presupuesto es lo que permite que el semáforo te avise antes, no después.`,
      icono: 'Wallet',
    })
    break
  }

  // Una deuda casi liquidada libera su mensualidad completa: el empujón final
  // rinde más que repartir el mismo dinero entre todas.
  for (const deuda of ctx.deudas.filter((d) => !d.liquidada && d.saldoActual > 0)) {
    const proyeccion = proyectarDeuda(deuda, pagos, ctx.hoy)
    if (proyeccion.pagosRestantes === null || proyeccion.pagosRestantes > 2) continue
    lista.push({
      id: `casi-${deuda.id}`,
      tipo: 'oportunidad',
      prioridad: 2,
      titulo: `Te faltan ${dinero(deuda.saldoActual)} para acabar con ${deuda.acreedor}`,
      detalle: `Liquidarla libera ${dinero(proyeccion.obligacionMensual)} al mes para siempre. Es el mejor uso de cualquier dinero extra que caiga.`,
      icono: 'Sparkles',
    })
  }

  // Sin fondo de emergencia no hay plan que aguante un imprevisto.
  const tieneEmergencia = ctx.metas.some((m) => /emergenc|imprevist|colch/i.test(m.nombre))
  if (!tieneEmergencia && margen.ingresos > 0) {
    const objetivo = Math.round(promedioEgresosMensuales(ctx) * 3)
    if (objetivo > 0) {
      lista.push({
        id: 'sin-fondo-emergencia',
        tipo: 'meta',
        prioridad: 3,
        titulo: 'No tienes un fondo de emergencia',
        detalle: `Con tu ritmo de gasto, tres meses son ${dinero(objetivo)}. Es lo que evita que un imprevisto se convierta en deuda cara.`,
        icono: 'Shield',
      })
    }
  }

  // Pagar todo con crédito esconde el gasto real hasta que llega el corte.
  const aCredito = sumar(
    delPeriodo.filter((t) => t.tipo === 'egreso' && t.metodoPago === 'credito').map((t) => t.monto),
  )
  if (totalEgresos > 0 && aCredito / totalEgresos > 0.5) {
    lista.push({
      id: 'mucho-credito',
      tipo: 'habito',
      prioridad: 3,
      titulo: `${Math.round((aCredito / totalEgresos) * 100)}% de tu gasto va con tarjeta de crédito`,
      detalle: `Son ${dinero(aCredito)} que todavía no salen de tu cuenta. El semáforo ya los cuenta, pero tu saldo del banco no.`,
      icono: 'CreditCard',
    })
  }

  // Reconocer lo que va bien: una app que solo regaña se deja de abrir.
  const excedenteAnterior = totalPorTipo(transaccionesDelPeriodo(ctx.transacciones, anterior), 'egreso')
  if (excedenteAnterior > 0 && totalEgresos > 0 && totalEgresos < excedenteAnterior * 0.9) {
    lista.push({
      id: 'vas-mejor',
      tipo: 'oportunidad',
      prioridad: 6,
      titulo: `Vas gastando ${dinero(excedenteAnterior - totalEgresos)} menos que ${nombrePeriodo(anterior)}`,
      detalle: 'Si mantienes el ritmo, ese dinero puede ir directo a tu deuda más cara o a tu meta más cercana.',
      icono: 'TrendingDown',
    })
  }

  // ── Guía para salir de deudas ──────────────────────────────────────────────

  const vivas = ctx.deudas.filter((d) => !d.liquidada && d.saldoActual > 0)
  if (vivas.length >= 2) {
    const ordenadas = [...vivas].sort((a, b) => (b.tasaInteres ?? 0) - (a.tasaInteres ?? 0))
    const cara = ordenadas[0]
    const chica = [...vivas].sort((a, b) => a.saldoActual - b.saldoActual)[0]
    lista.push({
      id: 'orden-de-ataque',
      tipo: 'deuda',
      prioridad: 3,
      titulo: `Tienes ${vivas.length} deudas: atácalas en orden, no todas a la vez`,
      detalle: cara.tasaInteres
        ? `Paga el mínimo de todas y mete cada peso extra en ${cara.acreedor}, que cobra ${cara.tasaInteres}% anual. Cuando caiga, ese pago completo va a la siguiente. Si te cuesta mantener el ánimo, empieza por ${chica.acreedor} (${dinero(chica.saldoActual)}) y usa la victoria como impulso.`
        : `Paga el mínimo de todas y mete lo extra en ${chica.acreedor}, tu saldo más chico. Al liquidarla, su pago mensual se suma al siguiente ataque: es el efecto bola de nieve.`,
      icono: 'Swords',
    })
  }

  const totalDeuda = vivas.reduce((suma, d) => suma + d.saldoActual, 0)
  if (totalDeuda > 0 && margen.ingresos > 0) {
    const extra = Math.round(margen.ingresos * 0.1)
    const objetivo = deudaPrioritaria(ctx.deudas)
    if (objetivo && extra > 0) {
      const proyeccion = proyectarDeuda(objetivo, pagos, ctx.hoy)
      const ahorrados = mesesAhorrados(objetivo, proyeccion.ritmoUsado, extra)
      if (ahorrados > 0) {
        lista.push({
          id: 'regla-diez',
          tipo: 'deuda',
          prioridad: 4,
          titulo: `Con ${dinero(extra)} extra al mes acabas ${ahorrados} ${ahorrados === 1 ? 'mes' : 'meses'} antes`,
          detalle: `Es el 10% de lo que te entra. Prográmalo el día que cobras, antes de gastarlo: lo que sobra a fin de mes nunca sobra.`,
          icono: 'Sparkles',
        })
      }
    }
  }

  // ── Guía para subir el puntaje ─────────────────────────────────────────────

  const salud = calcularSalud(ctx)
  if (salud.suficiente) {
    // El componente aplicable con más puntos sobre la mesa es donde más rinde
    // el esfuerzo; decirlo evita consejos genéricos.
    const flojo = salud.componentes
      .filter((c) => c.aplicable && c.calificacion < 0.7)
      .sort((a, b) => (1 - b.calificacion) * b.peso - (1 - a.calificacion) * a.peso)[0]

    if (flojo) {
      const COMO: Record<string, string> = {
        ahorro: `Apártalo el día que cobras, no a fin de ${margen.ciclo.nombre}. Empieza por el 5% de tu ingreso, súbelo un punto cada mes y no lo toques.`,
        deuda: 'Baja la carga liquidando primero la deuda más chica: cada una que cae libera su mensualidad completa para la siguiente.',
        presupuesto: 'Pon topes solo a las tres categorías donde más se te va. Un presupuesto que no se puede cumplir se ignora y deja de servir.',
        metas: 'Ajusta el plazo o el monto de la meta que no llega. Una meta imposible desanima; una realista sostiene el hábito.',
      }
      const puntosEnJuego = Math.round((1 - flojo.calificacion) * flojo.peso)
      lista.push({
        id: 'subir-salud',
        tipo: 'oportunidad',
        prioridad: 3,
        titulo: `Donde más ganas: ${flojo.nombre.toLowerCase()} (${puntosEnJuego} puntos en juego)`,
        detalle: COMO[flojo.clave] ?? flojo.detalle,
        icono: 'ChartNoAxesColumnIncreasing',
      })
    }
  }

  // ── Hábitos que sostienen el resto ─────────────────────────────────────────

  const diasSinRegistrar = ctx.transacciones.length
    ? diasEntre(
        [...ctx.transacciones].sort((a, b) => b.fecha.localeCompare(a.fecha))[0].fecha,
        ctx.hoy,
      )
    : 0
  if (diasSinRegistrar >= 5) {
    lista.push({
      id: 'sin-registrar',
      tipo: 'habito',
      prioridad: 2,
      titulo: `Llevas ${enDias(diasSinRegistrar)} sin registrar nada`,
      detalle: 'Los huecos son lo único que rompe estos números. Registrar toma cinco segundos y es lo que hace que el semáforo sirva.',
      icono: 'CircleAlert',
    })
  }

  if (margen.ciclo.tipo !== 'mensual' && margen.margenDisponible > 0 && margen.ciclo.diasRestantes <= 3) {
    lista.push({
      id: 'sobrante-ciclo',
      tipo: 'oportunidad',
      prioridad: 4,
      titulo: `Te sobran ${dinero(margen.margenDisponible)} y ${esteCiclo(margen.ciclo.tipo)} cierra en ${margen.ciclo.diasRestantes} ${margen.ciclo.diasRestantes === 1 ? 'día' : 'días'}`,
      detalle: 'Muévelo hoy a una meta o a tu deuda más cara. Lo que se queda en la cuenta al empezar el siguiente ciclo se gasta solo.',
      icono: 'PiggyBank',
    })
  }


  // ── Razones financieras ────────────────────────────────────────────────
  //
  // Lo que un contador mira antes que el detalle de las categorías: si la
  // estructura aguanta. Ninguna depende de en qué día del mes se consulte.

  const ind = calcularIndicadores(ctx)
  const pct = (x: number) => `${Math.round(x * 100)}%`

  if (ind.ingresoMensual > 0 && ind.cargaDeuda > 0.36) {
    const critico = ind.cargaDeuda > 0.43
    lista.push({
      id: 'carga-deuda',
      tipo: 'deuda',
      prioridad: critico ? 1 : 2,
      titulo: `Tus deudas se llevan ${pct(ind.cargaDeuda)} de lo que ganas`,
      detalle: critico
        ? `Arriba del 43% ningún banco te presta, y no por capricho: no queda de dónde salir si algo falla. Bajar a ${dinero(Math.round(ind.ingresoMensual * 0.36))} al mes es el primer objetivo, aunque sea alargando plazos.`
        : `El límite sano son 36 puntos, o sea ${dinero(Math.round(ind.ingresoMensual * 0.36))} al mes. Estás encima: cualquier gasto no previsto va a salir de una tarjeta.`,
      icono: 'Scale',
    })
  }

  if (ind.ingresoMensual > 0 && ind.cargaFija > 0.5) {
    lista.push({
      id: 'carga-fija',
      tipo: 'presupuesto',
      prioridad: 2,
      titulo: `Tus gastos fijos comprometen ${pct(ind.cargaFija)} de tu ingreso`,
      detalle: `Renta, servicios y suscripciones se cobran solos: pasado el 50% ya no hay presupuesto que administrar, solo lo que sobre. Lo que se recorta aquí rinde todos los meses, no una vez.`,
      icono: 'Repeat',
    })
  }

  if (ind.mesesDeColchon !== null && ind.mesesDeColchon < 3 && ind.gastoMensual > 0) {
    const meses = ind.mesesDeColchon
    lista.push({
      id: 'colchon-corto',
      tipo: 'meta',
      prioridad: meses < 1 ? 1 : 3,
      titulo:
        meses < 1
          ? 'Tu cuenta no cubre un mes de gastos'
          : `Tu cuenta cubre ${meses.toFixed(1)} meses de gastos`,
      detalle: `Gastas ${dinero(ind.gastoMensual)} al mes. Tres meses son ${dinero(Math.round(ind.gastoMensual * 3))}: es la diferencia entre un imprevisto y una deuda cara. Te faltan ${dinero(Math.max(0, Math.round(ind.gastoMensual * 3) - Math.round(ind.gastoMensual * meses)))}.`,
      icono: 'Umbrella',
    })
  }

  if (ind.ingresoMensual > 0 && ind.tasaAhorro > 0 && ind.tasaAhorro < 0.1) {
    lista.push({
      id: 'tasa-ahorro',
      tipo: 'meta',
      prioridad: 4,
      titulo: `Estás apartando ${pct(ind.tasaAhorro)} de lo que ganas`,
      detalle: `El piso que se recomienda es 10%, o sea ${dinero(Math.round(ind.ingresoMensual * 0.1))} al mes. Prográmalo el día que cobras: lo que sobra a fin de mes nunca sobra.`,
      icono: 'PiggyBank',
    })
  }

  // Descalce de flujo: hay un pago con fecha antes de que caiga el cobro y la
  // cuenta de hoy no lo cubre. Es el problema que hunde a la gente que sí
  // tiene con qué pagar — solo que no el día que le toca.
  if (margen.efectivoHoy !== null && margen.compromisoDeuda > margen.efectivoHoy) {
    const proximo = proximosVencimientos(ctx.deudas, ctx.hoy, margen.ciclo.diasRestantes)[0]
    if (proximo) {
      lista.push({
        id: 'descalce-flujo',
        tipo: 'deuda',
        prioridad: 1,
        titulo: `El pago a ${proximo.deuda.acreedor} vence antes de que tengas con qué`,
        detalle: `Vence el ${formatearFechaCorta(proximo.fecha, f.locale)} y son ${dinero(proximo.monto)}; en la cuenta hay ${dinero(margen.efectivoHoy)}. ${margen.porEntrar > 0 ? `Tu cobro de ${dinero(margen.porEntrar)} lo cubre, pero comprueba que caiga antes de esa fecha.` : 'No hay ingreso previsto antes de esa fecha: mueve el pago o consigue el dinero ahora, no el día que venza.'}`,
        icono: 'CalendarClock',
      })
    }
  }

  // El ahorro que convive con una tarjeta cara pierde dinero todos los meses.
  const cara = ctx.deudas
    .filter((d) => !d.liquidada && d.saldoActual > 0 && (d.tasaInteres ?? 0) >= 25)
    .sort((a, b) => (b.tasaInteres ?? 0) - (a.tasaInteres ?? 0))[0]
  const ahorroDisponible = ctx.metas.reduce((suma, m) => suma + m.montoActual, 0)
  if (cara && ahorroDisponible > 0) {
    const costoAnual = Math.round(Math.min(ahorroDisponible, cara.saldoActual) * ((cara.tasaInteres ?? 0) / 100))
    lista.push({
      id: 'ahorro-contra-deuda-cara',
      tipo: 'oportunidad',
      prioridad: 2,
      titulo: `Ahorrar mientras pagas ${cara.tasaInteres}% te cuesta ${dinero(costoAnual)} al año`,
      detalle: `Tienes ${dinero(ahorroDisponible)} apartados y ${dinero(cara.saldoActual)} con ${cara.acreedor} al ${cara.tasaInteres}% anual. Ninguna cuenta de ahorro paga eso: mientras las dos cosas convivan, estás pagando por guardar tu propio dinero. Deja solo el fondo de emergencia y el resto va al saldo.`,
      icono: 'Scale',
    })
  }

  return lista.sort((a, b) => a.prioridad - b.prioridad)
}

/** Gasto medio de los tres meses anteriores completos. */
function promedioEgresosMensuales(ctx: ContextoFinanciero): number {
  const periodos = ultimosPeriodos(periodoAnterior(ctx.periodo), 3)
  const totales = periodos.map((p) => totalPorTipo(transaccionesDelPeriodo(ctx.transacciones, p), 'egreso'))
  const conGasto = totales.filter((t) => t > 0)
  if (conGasto.length === 0) return 0
  return Math.round(sumar(conGasto) / conGasto.length)
}

/** Cuánto se gastó de más frente al presupuesto, sumando todas las categorías. */
export function excesoDelPeriodo(ctx: ContextoFinanciero): number {
  const delMes = transaccionesDelPeriodo(ctx.transacciones, ctx.periodo)
  const gastos = gastoPorCategoria(delMes)
  return sumar(
    presupuestosDelPeriodo(ctx.presupuestos, ctx.periodo).map((p) => {
      const gastado = p.categoriaId ? (gastos.get(p.categoriaId) ?? 0) : totalPorTipo(delMes, 'egreso')
      return Math.max(0, gastado - p.montoLimite)
    }),
  )
}
