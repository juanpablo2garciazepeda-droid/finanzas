import { describe, expect, it } from 'vitest'
import { deuda, pago } from './fixtures'
import {
  compromisoDeudas,
  deudaPrioritaria,
  mesesAhorrados,
  obligacionMensual,
  planDePagos,
  proximosVencimientos,
  proyectarDeuda,
  simularLiquidacion,
} from './deudas'

describe('simularLiquidacion', () => {
  it('divide el saldo entre el pago cuando no hay interés', () => {
    expect(simularLiquidacion(1_000_000, 250_000, null).meses).toBe(4)
  })

  it('redondea hacia arriba el último mes parcial', () => {
    expect(simularLiquidacion(1_000_000, 300_000, null).meses).toBe(4)
  })

  it('alarga el plazo y cobra intereses cuando hay tasa', () => {
    const sinTasa = simularLiquidacion(5_000_000, 500_000, null)
    const conTasa = simularLiquidacion(5_000_000, 500_000, 36)
    expect(conTasa.meses).toBeGreaterThan(sinTasa.meses!)
    expect(conTasa.interes).toBeGreaterThan(0)
  })

  it('devuelve null cuando el pago no cubre ni los intereses', () => {
    // 100,000 al 60% anual genera 5,000 de interés al mes; pagar 4,000 no baja nada.
    expect(simularLiquidacion(100_000, 4_000, 60).meses).toBeNull()
  })

  it('trata un saldo liquidado como cero meses', () => {
    expect(simularLiquidacion(0, 100_000, 24).meses).toBe(0)
  })

  it('devuelve null si no se está pagando nada', () => {
    expect(simularLiquidacion(100_000, 0, null).meses).toBeNull()
  })
})

describe('proyectarDeuda', () => {
  it('usa el ritmo real de los últimos tres meses', () => {
    const d = deuda({ id: 'd1', saldoActual: 900_000 })
    const pagos = [
      pago({ deudaId: 'd1', monto: 300_000, fecha: '2026-06-10' }),
      pago({ deudaId: 'd1', monto: 300_000, fecha: '2026-07-10' }),
      pago({ deudaId: 'd1', monto: 300_000, fecha: '2026-08-10' }),
    ]
    const proyeccion = proyectarDeuda(d, pagos, '2026-08-13')
    expect(proyeccion.ritmoMensual).toBe(300_000)
    expect(proyeccion.mesesRestantes).toBe(3)
    expect(proyeccion.periodoLiquidacion).toBe('2026-11')
  })

  it('cae al pago mínimo cuando todavía no hay historial', () => {
    const d = deuda({ id: 'd2', saldoActual: 500_000, pagoMinimo: 100_000 })
    const proyeccion = proyectarDeuda(d, [], '2026-08-13')
    expect(proyeccion.ritmoMensual).toBe(0)
    expect(proyeccion.ritmoUsado).toBe(100_000)
    expect(proyeccion.mesesRestantes).toBe(5)
  })

  it('ignora pagos de otras deudas', () => {
    const d = deuda({ id: 'd3', saldoActual: 500_000, pagoMinimo: 50_000 })
    const proyeccion = proyectarDeuda(d, [pago({ deudaId: 'otra', monto: 900_000 })], '2026-08-13')
    expect(proyeccion.ritmoMensual).toBe(0)
    expect(proyeccion.totalPagado).toBe(0)
  })

  it('marca como ahogada la deuda que no baja', () => {
    const d = deuda({ id: 'd4', saldoActual: 100_000, pagoMinimo: 4_000, tasaInteres: 60 })
    expect(proyectarDeuda(d, [], '2026-08-13').ahogada).toBe(true)
  })
})

describe('proximosVencimientos', () => {
  it('ordena por urgencia y adelanta los mensuales vencidos', () => {
    const lejana = deuda({ acreedor: 'Lejana', fechaLimite: '2026-08-28' })
    const vieja = deuda({ acreedor: 'Vieja', fechaLimite: '2026-05-15', periodicidad: 'mensual' })
    const lista = proximosVencimientos([lejana, vieja], '2026-08-13', 30)
    expect(lista.map((v) => v.deuda.acreedor)).toEqual(['Vieja', 'Lejana'])
    expect(lista[0].fecha).toBe('2026-08-15')
  })

  it('deja vencidas las de pago único que ya pasaron', () => {
    const d = deuda({ acreedor: 'Préstamo', fechaLimite: '2026-08-01', periodicidad: 'unico' })
    const [v] = proximosVencimientos([d], '2026-08-13', 30)
    expect(v.vencido).toBe(true)
    expect(v.dias).toBe(-12)
  })

  it('excluye las deudas liquidadas', () => {
    const d = deuda({ liquidada: true, saldoActual: 0 })
    expect(proximosVencimientos([d], '2026-08-13', 30)).toHaveLength(0)
  })

  it('no cobra más que el saldo restante', () => {
    const d = deuda({ saldoActual: 30_000, pagoMinimo: 100_000 })
    expect(proximosVencimientos([d], '2026-08-13', 30)[0].monto).toBe(30_000)
  })
})

describe('compromisoDeudas', () => {
  it('solo suma lo que cae dentro de la ventana de aviso', () => {
    const cerca = deuda({ fechaLimite: '2026-08-16', pagoMinimo: 50_000 })
    const lejos = deuda({ fechaLimite: '2026-08-30', pagoMinimo: 90_000 })
    expect(compromisoDeudas([cerca, lejos], '2026-08-13', 7)).toBe(50_000)
  })
})

describe('planDePagos', () => {
  it('sin tasa reparte el monto entre los pagos', () => {
    const plan = planDePagos(900_000, 9, null, 'mensual')
    expect(plan.porPago).toBe(100_000)
    expect(plan.mensual).toBe(100_000)
    expect(plan.totalConIntereses).toBe(900_000)
  })

  it('con tasa el pago sube y el total supera al monto', () => {
    const plan = planDePagos(1_000_000, 12, 24, 'mensual')
    expect(plan.porPago).toBeGreaterThan(Math.ceil(1_000_000 / 12))
    expect(plan.totalConIntereses).toBeGreaterThan(1_000_000)
  })

  it('convierte pagos quincenales a compromiso mensual', () => {
    const plan = planDePagos(1_200_000, 24, null, 'quincenal')
    expect(plan.porPago).toBe(50_000)
    expect(plan.mensual).toBe(100_000)
  })

  it('no divide entre cero', () => {
    expect(planDePagos(500_000, 0, null, 'mensual').porPago).toBe(0)
    expect(planDePagos(0, 12, null, 'mensual').porPago).toBe(0)
  })
})

describe('pagosRestantes', () => {
  it('cuenta los abonos que faltan, no los meses, cuando son quincenales', () => {
    const d = deuda({ saldoActual: 600_000, pagoMinimo: 50_000, periodicidad: 'quincenal' })
    const proyeccion = proyectarDeuda(d, [], '2026-08-13')
    // 100,000 al mes sobre 600,000 son 6 meses, es decir 12 quincenas.
    expect(proyeccion.mesesRestantes).toBe(6)
    expect(proyeccion.pagosRestantes).toBe(12)
  })

  it('una deuda de pago único tiene un solo abono pendiente', () => {
    const d = deuda({ saldoActual: 500_000, pagoMinimo: 500_000, periodicidad: 'unico' })
    expect(proyectarDeuda(d, [], '2026-08-13').pagosRestantes).toBe(1)
  })

  it('es null si la deuda nunca se liquida', () => {
    const d = deuda({ saldoActual: 100_000, pagoMinimo: 4_000, tasaInteres: 60 })
    expect(proyectarDeuda(d, [], '2026-08-13').pagosRestantes).toBeNull()
  })
})

describe('obligacionMensual', () => {
  it('no depende de la fecha de corte', () => {
    const lejos = deuda({ fechaLimite: '2026-12-01', pagoMinimo: 100_000, periodicidad: 'mensual' })
    expect(obligacionMensual([lejos])).toBe(100_000)
  })

  it('multiplica los pagos semanales y quincenales', () => {
    expect(obligacionMensual([deuda({ pagoMinimo: 50_000, periodicidad: 'semanal' })])).toBe(200_000)
    expect(obligacionMensual([deuda({ pagoMinimo: 50_000, periodicidad: 'quincenal' })])).toBe(100_000)
  })

  it('no exige más que el saldo restante', () => {
    expect(obligacionMensual([deuda({ saldoActual: 30_000, pagoMinimo: 100_000 })])).toBe(30_000)
  })

  it('ignora las liquidadas', () => {
    expect(obligacionMensual([deuda({ liquidada: true, saldoActual: 0 })])).toBe(0)
  })
})

describe('deudaPrioritaria', () => {
  it('elige la de mayor tasa', () => {
    const cara = deuda({ acreedor: 'Tarjeta', tasaInteres: 65 })
    const barata = deuda({ acreedor: 'Auto', tasaInteres: 12 })
    expect(deudaPrioritaria([barata, cara])?.acreedor).toBe('Tarjeta')
  })

  it('sin tasas registradas elige el saldo más chico', () => {
    const grande = deuda({ acreedor: 'Grande', saldoActual: 900_000 })
    const chica = deuda({ acreedor: 'Chica', saldoActual: 50_000 })
    expect(deudaPrioritaria([grande, chica])?.acreedor).toBe('Chica')
  })

  it('devuelve null si no hay deudas vivas', () => {
    expect(deudaPrioritaria([deuda({ liquidada: true })])).toBeNull()
  })
})

describe('mesesAhorrados', () => {
  it('cuenta los meses que recorta un abono extra', () => {
    const d = deuda({ saldoActual: 1_200_000 })
    expect(mesesAhorrados(d, 100_000, 100_000)).toBe(6)
  })

  it('no promete nada si no hay extra', () => {
    expect(mesesAhorrados(deuda(), 100_000, 0)).toBe(0)
  })
})
