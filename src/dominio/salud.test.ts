import { describe, expect, it } from 'vitest'
import { calcularSalud, etiquetaSalud, serieHistorica } from './salud'
import { calcularEstados, compararPeriodos, nivelPorConsumo } from './presupuestos'
import { CATEGORIAS, contexto, deuda, meta, presupuesto, transaccion } from './fixtures'

function sueldo(monto: number, fecha: string) {
  return transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto, fecha })
}

describe('nivelPorConsumo', () => {
  it('cambia de color en los umbrales', () => {
    expect(nivelPorConsumo(0.5, 0.8)).toBe('verde')
    expect(nivelPorConsumo(0.8, 0.8)).toBe('ambar')
    expect(nivelPorConsumo(1, 0.8)).toBe('rojo')
    expect(nivelPorConsumo(1.4, 0.8)).toBe('rojo')
  })
})

describe('calcularEstados', () => {
  it('mide gasto contra límite y ordena por consumo', () => {
    const estados = calcularEstados(
      [
        presupuesto({ categoriaId: 'comida', montoLimite: 400_000 }),
        presupuesto({ categoriaId: 'renta', montoLimite: 1_000_000 }),
      ],
      [transaccion({ categoriaId: 'comida', monto: 380_000 }), transaccion({ categoriaId: 'renta', monto: 200_000 })],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].nombre).toBe('Comida')
    expect(estados[0].nivel).toBe('ambar')
    expect(estados[0].restante).toBe(20_000)
    expect(estados[1].nivel).toBe('verde')
  })

  it('el presupuesto global mide todo el egreso del mes', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: null, montoLimite: 500_000 })],
      [transaccion({ categoriaId: 'comida', monto: 300_000 }), transaccion({ categoriaId: 'renta', monto: 400_000 })],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].gastado).toBe(700_000)
    expect(estados[0].restante).toBe(-200_000)
    expect(estados[0].nivel).toBe('rojo')
  })

  it('no cuenta los ingresos como gasto', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: null, montoLimite: 500_000 })],
      [sueldo(2_000_000, '2026-08-01'), transaccion({ monto: 100_000 })],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].gastado).toBe(100_000)
  })
})

describe('compararPeriodos', () => {
  it('calcula la variación contra el mes anterior', () => {
    const comparativa = compararPeriodos(
      [transaccion({ categoriaId: 'comida', monto: 300_000 })],
      [transaccion({ categoriaId: 'comida', monto: 200_000 })],
      CATEGORIAS,
    )
    expect(comparativa[0].variacion).toBeCloseTo(0.5)
  })

  it('deja la variación en null cuando no hay base de comparación', () => {
    const comparativa = compararPeriodos([transaccion({ monto: 100_000 })], [], CATEGORIAS)
    expect(comparativa[0].variacion).toBeNull()
  })
})

describe('calcularSalud', () => {
  it('premia ahorrar y no tener deuda', () => {
    const ctx = contexto({
      transacciones: [
        sueldo(2_000_000, '2026-06-01'),
        sueldo(2_000_000, '2026-07-01'),
        sueldo(2_000_000, '2026-08-01'),
        transaccion({ monto: 1_400_000, fecha: '2026-06-10' }),
        transaccion({ monto: 1_400_000, fecha: '2026-07-10' }),
        transaccion({ monto: 1_400_000, fecha: '2026-08-10' }),
      ],
    })
    const salud = calcularSalud(ctx)
    expect(salud.puntaje).toBe(100)
    expect(salud.etiqueta).toBe('Sólida')
  })

  it('castiga gastar todo lo que entra', () => {
    const ctx = contexto({
      transacciones: [sueldo(2_000_000, '2026-08-01'), transaccion({ monto: 2_000_000, fecha: '2026-08-10' })],
    })
    expect(calcularSalud(ctx).puntaje).toBeLessThan(60)
  })

  it('saca del promedio los componentes sin datos', () => {
    const ctx = contexto({ transacciones: [sueldo(2_000_000, '2026-08-01')] })
    const salud = calcularSalud(ctx)
    const metas = salud.componentes.find((c) => c.clave === 'metas')
    const presupuestos = salud.componentes.find((c) => c.clave === 'presupuesto')
    expect(metas?.aplicable).toBe(false)
    expect(presupuestos?.aplicable).toBe(false)
    // Sin metas ni presupuestos definidos el puntaje no se hunde a cero.
    expect(salud.puntaje).toBeGreaterThan(60)
  })

  it('baja el puntaje cuando la deuda se lleva medio sueldo', () => {
    const conDeuda = contexto({
      transacciones: [sueldo(1_000_000, '2026-08-01')],
      deudas: [deuda({ fechaLimite: '2026-08-15', pagoMinimo: 500_000, saldoActual: 5_000_000 })],
    })
    const sinDeuda = contexto({ transacciones: [sueldo(1_000_000, '2026-08-01')] })
    expect(calcularSalud(conDeuda).puntaje).toBeLessThan(calcularSalud(sinDeuda).puntaje)
  })

  it('no da puntaje cuando casi nada aplica', () => {
    // Solo "carga de deuda" aplica (no hay deudas), y eso daría 100 de la nada.
    const salud = calcularSalud(contexto())
    expect(salud.suficiente).toBe(false)
    expect(salud.etiqueta).toBe('Sin datos suficientes')
  })

  it('da puntaje en cuanto hay dos componentes con datos', () => {
    const salud = calcularSalud(
      contexto({ transacciones: [sueldo(2_000_000, '2026-08-01')] }),
    )
    expect(salud.suficiente).toBe(true)
    expect(salud.etiqueta).not.toBe('Sin datos suficientes')
  })

  it('el puntaje no cambia según lo cerca que esté la fecha de corte', () => {
    const base = { transacciones: [sueldo(2_000_000, '2026-08-01')] }
    const cerca = contexto({
      ...base,
      deudas: [deuda({ fechaLimite: '2026-08-15', pagoMinimo: 400_000, saldoActual: 5_000_000 })],
    })
    const lejos = contexto({
      ...base,
      deudas: [deuda({ fechaLimite: '2026-08-28', pagoMinimo: 400_000, saldoActual: 5_000_000 })],
    })
    expect(calcularSalud(cerca).puntaje).toBe(calcularSalud(lejos).puntaje)
  })

  it('cuenta las metas en riesgo a la mitad', () => {
    const ctx = contexto({
      transacciones: [sueldo(2_000_000, '2026-08-01')],
      metas: [meta({ montoObjetivo: 1_000_000, aporteMensual: 1_000, fechaLimite: '2026-10-01' })],
    })
    const componente = calcularSalud(ctx).componentes.find((c) => c.clave === 'metas')
    expect(componente?.aplicable).toBe(true)
    expect(componente?.calificacion).toBeLessThan(1)
  })
})

describe('etiquetaSalud', () => {
  it('nombra cada tramo', () => {
    expect(etiquetaSalud(90)).toBe('Sólida')
    expect(etiquetaSalud(70)).toBe('Estable')
    expect(etiquetaSalud(50)).toBe('Ajustada')
    expect(etiquetaSalud(20)).toBe('Frágil')
  })
})

describe('serieHistorica', () => {
  it('devuelve un punto por mes, del más viejo al más nuevo', () => {
    const ctx = contexto({
      transacciones: [sueldo(1_000_000, '2026-07-01'), transaccion({ monto: 300_000, fecha: '2026-08-02' })],
    })
    const serie = serieHistorica(ctx, 3)
    expect(serie.map((p) => p.periodo)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(serie[1].balance).toBe(1_000_000)
    expect(serie[2].balance).toBe(-300_000)
  })
})
