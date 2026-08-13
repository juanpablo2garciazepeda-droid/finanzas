import type { Transaccion } from '@/dominio/tipos'
import { hoyISO, periodoActual, rangoPeriodo, sumarMeses } from '@/dominio/fechas'
import { ahora, db, nuevoId } from './db'
import {
  crearDeuda,
  crearMeta,
  fijarPresupuesto,
  registrarAporte,
  registrarPago,
} from './repositorio'

/**
 * Datos de ejemplo de cuatro meses para poder ver la app trabajando sin
 * capturar nada. Están construidos para que el semáforo y las recomendaciones
 * tengan algo que decir: una categoría rebasada varias veces, una deuda cara y
 * una meta que no llega a tiempo.
 */

function fechaEn(periodo: string, dia: number): string {
  const { fin } = rangoPeriodo(periodo)
  const ultimo = Number(fin.slice(8, 10))
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}

/** Varía un monto ±porcentaje para que las series no salgan planas. */
function variar(monto: number, porcentaje: number, semilla: number): number {
  const desvio = Math.sin(semilla * 12.9898) * porcentaje
  return Math.round(monto * (1 + desvio))
}

export async function cargarDatosDemo(): Promise<void> {
  // Todo dentro de una transacción: son casi doscientas escrituras y, sueltas,
  // cada una dispara un repintado con la app a medio poblar.
  await db.transaction(
    'rw',
    [db.categorias, db.transacciones, db.presupuestos, db.deudas, db.pagosDeuda, db.metas, db.aportesMeta],
    poblar,
  )
}

async function poblar(): Promise<void> {
  const categorias = await db.categorias.toArray()
  const buscar = (nombre: string) => categorias.find((c) => c.nombre === nombre)?.id ?? categorias[0].id

  const actual = periodoActual()
  const periodos = [sumarMeses(actual, -3), sumarMeses(actual, -2), sumarMeses(actual, -1), actual]
  const hoy = hoyISO()
  const diaDeHoy = Number(hoy.slice(8, 10))

  const movimientos: Transaccion[] = []
  const agregar = (
    periodo: string,
    dia: number,
    tipo: 'ingreso' | 'egreso',
    categoria: string,
    monto: number,
    metodoPago: Transaccion['metodoPago'],
    nota = '',
  ) => {
    // En el mes en curso solo se inventan movimientos hasta el día de hoy.
    if (periodo === actual && dia > diaDeHoy) return
    movimientos.push({
      id: nuevoId(),
      tipo,
      monto,
      categoriaId: buscar(categoria),
      fecha: fechaEn(periodo, dia),
      metodoPago,
      nota,
      creadoEn: ahora(),
    })
  }

  periodos.forEach((periodo, i) => {
    agregar(periodo, 1, 'ingreso', 'Sueldo', 1_100_000, 'transferencia', 'Quincena 1')
    agregar(periodo, 15, 'ingreso', 'Sueldo', 1_100_000, 'transferencia', 'Quincena 2')
    if (i % 2 === 0) agregar(periodo, 20, 'ingreso', 'Freelance', variar(450_000, 0.3, i), 'transferencia', 'Proyecto web')

    agregar(periodo, 2, 'egreso', 'Renta', 750_000, 'transferencia')
    agregar(periodo, 3, 'egreso', 'Servicios', variar(95_000, 0.25, i + 1), 'debito', 'Luz y agua')
    agregar(periodo, 4, 'egreso', 'Suscripciones', 42_900, 'credito', 'Streaming y música')
    agregar(periodo, 6, 'egreso', 'Súper', variar(180_000, 0.15, i + 2), 'debito')
    agregar(periodo, 13, 'egreso', 'Súper', variar(165_000, 0.15, i + 3), 'debito')
    agregar(periodo, 21, 'egreso', 'Súper', variar(190_000, 0.15, i + 4), 'debito')

    // Comida fuera: el hábito que dispara las recomendaciones.
    const comidas = [5, 8, 9, 12, 14, 17, 19, 22, 24, 26, 28]
    comidas.forEach((dia, j) => {
      agregar(periodo, dia, 'egreso', 'Comida', variar(18_000 + i * 2_000, 0.4, i * 10 + j), j % 3 === 0 ? 'credito' : 'debito')
    })

    const transportes = [3, 7, 10, 16, 23, 27]
    transportes.forEach((dia, j) => {
      agregar(periodo, dia, 'egreso', 'Transporte', variar(12_000, 0.35, i * 7 + j), 'debito')
    })

    agregar(periodo, 11, 'egreso', 'Entretenimiento', variar(45_000, 0.5, i + 5), 'credito')
    agregar(periodo, 18, 'egreso', 'Salud', variar(38_000, 0.6, i + 6), 'debito', 'Farmacia')
    if (i >= 1) agregar(periodo, 25, 'egreso', 'Compras', variar(120_000, 0.7, i + 7), 'credito')
  })

  await db.transacciones.bulkAdd(movimientos)

  // Presupuestos: comida deliberadamente corta para que la racha se dispare.
  for (const periodo of periodos) {
    await fijarPresupuesto(buscar('Comida'), periodo, 180_000)
    await fijarPresupuesto(buscar('Súper'), periodo, 550_000)
    await fijarPresupuesto(buscar('Transporte'), periodo, 90_000)
    await fijarPresupuesto(buscar('Entretenimiento'), periodo, 60_000)
    await fijarPresupuesto(buscar('Compras'), periodo, 100_000)
    await fijarPresupuesto(null, periodo, 2_100_000)
  }

  const tarjeta = await crearDeuda({
    acreedor: 'Tarjeta BBVA',
    montoOriginal: 2_800_000,
    tasaInteres: 62,
    fechaLimite: fechaEn(actual, Math.min(diaDeHoy + 4, 28)),
    periodicidad: 'mensual',
    pagoMinimo: 180_000,
  })
  const auto = await crearDeuda({
    acreedor: 'Crédito automotriz',
    montoOriginal: 12_000_000,
    tasaInteres: 14.5,
    fechaLimite: fechaEn(actual, 25),
    periodicidad: 'mensual',
    pagoMinimo: 420_000,
  })

  for (const [i, periodo] of periodos.entries()) {
    if (periodo === actual) continue
    await registrarPago(tarjeta, 200_000, fechaEn(periodo, 12), 'Pago mensual', i === periodos.length - 2)
    await registrarPago(auto, 420_000, fechaEn(periodo, 25), 'Mensualidad', false)
  }

  const emergencia = await crearMeta({
    nombre: 'Fondo de emergencia',
    montoObjetivo: 6_000_000,
    fechaLimite: `${sumarMeses(actual, 10)}-01`,
    prioridad: 1,
    aporteMensual: 300_000,
    icono: 'Shield',
  })
  const viaje = await crearMeta({
    nombre: 'Viaje a Japón',
    montoObjetivo: 4_500_000,
    fechaLimite: `${sumarMeses(actual, 6)}-01`,
    prioridad: 2,
    aporteMensual: 150_000,
    icono: 'Plane',
  })

  for (const periodo of periodos) {
    if (periodo === actual) continue
    await registrarAporte(emergencia, 300_000, fechaEn(periodo, 16), 'Aporte mensual')
    await registrarAporte(viaje, 120_000, fechaEn(periodo, 16), 'Aporte mensual')
  }
}
