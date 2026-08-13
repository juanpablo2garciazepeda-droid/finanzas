import { describe, expect, it } from 'vitest'
import { calcularMargen, evaluarGasto, ingresoTipico, peorNivel } from './alertas'
import { AJUSTES, contexto, deuda, meta, pago, presupuesto, transaccion } from './fixtures'

const SUELDO = transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_000_000, fecha: '2026-08-01' })

describe('peorNivel', () => {
  it('se queda con el nivel más grave', () => {
    expect(peorNivel(['verde', 'ambar', 'verde'])).toBe('ambar')
    expect(peorNivel(['ambar', 'rojo'])).toBe('rojo')
    expect(peorNivel([])).toBe('verde')
  })
})

describe('calcularMargen', () => {
  it('resta deudas próximas y aportes pendientes del balance', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 500_000 })],
      deudas: [deuda({ fechaLimite: '2026-08-15', pagoMinimo: 300_000 })],
      metas: [meta({ id: 'm1', aporteMensual: 200_000 })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.egresos).toBe(500_000)
    expect(margen.balance).toBe(1_500_000)
    expect(margen.compromisoDeuda).toBe(300_000)
    expect(margen.compromisoMeta).toBe(200_000)
    expect(margen.margenLibre).toBe(1_000_000)
  })

  it('descuenta del compromiso de meta lo ya aportado en el mes', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      metas: [meta({ id: 'm1', aporteMensual: 200_000 })],
      aportes: [{ id: 'a1', metaId: 'm1', monto: 150_000, fecha: '2026-08-03', nota: '' }],
    })
    expect(calcularMargen(ctx).compromisoMeta).toBe(50_000)
  })

  it('reparte el margen entre los días que quedan del mes', () => {
    const ctx = contexto({ transacciones: [SUELDO] })
    const margen = calcularMargen(ctx)
    expect(margen.diasRestantes).toBe(19)
    expect(margen.gastoDiarioSugerido).toBe(Math.floor(2_000_000 / 19))
  })

  it('usa el sueldo configurado mientras no cae la nómina del mes', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [transaccion({ monto: 100_000, fecha: '2026-08-02' })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_500_000)
    expect(margen.ingresosEstimados).toBe(true)
    expect(margen.balance).toBe(2_400_000)
  })

  it('el ingreso real del mes gana sobre el sueldo configurado', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [SUELDO],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.ingresosEstimados).toBe(false)
  })

  it('el sueldo configurado gana sobre el promedio histórico', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-01' }),
      ],
    })
    expect(calcularMargen(ctx).ingresos).toBe(2_500_000)
  })

  it('estima los ingresos con el histórico cuando el mes aún no tiene nómina', () => {
    const ctx = contexto({
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_800_000, fecha: '2026-06-01' }),
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_200_000, fecha: '2026-07-01' }),
        transaccion({ monto: 100_000, fecha: '2026-08-02' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresosEstimados).toBe(true)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.balance).toBe(1_900_000)
  })
})

describe('calcularMargen con ciclo quincenal', () => {
  const QUINCENAL = { ...AJUSTES, cicloPago: 'quincenal' as const }

  it('solo cuenta los movimientos de la quincena en curso', () => {
    const ctx = contexto({
      ajustes: QUINCENAL,
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_000_000, fecha: '2026-08-01' }),
        transaccion({ monto: 200_000, fecha: '2026-08-05' }),
        // Fuera de la primera quincena: no debe contar el 13 de agosto.
        transaccion({ monto: 900_000, fecha: '2026-08-20' }),
      ],
      hoy: '2026-08-10',
    })
    const margen = calcularMargen(ctx)
    expect(margen.ciclo.inicio).toBe('2026-08-01')
    expect(margen.ciclo.fin).toBe('2026-08-15')
    expect(margen.ingresos).toBe(1_000_000)
    expect(margen.egresos).toBe(200_000)
  })

  it('reparte el sueldo configurado entre las dos quincenas', () => {
    const ctx = contexto({
      ajustes: { ...QUINCENAL, ingresoMensual: 2_000_000 },
      transacciones: [transaccion({ monto: 50_000, fecha: '2026-08-18' })],
      hoy: '2026-08-20',
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(1_000_000)
    expect(margen.ingresosEstimados).toBe(true)
  })

  it('reparte el aporte a metas entre las quincenas que quedan del mes', () => {
    const base = { ajustes: QUINCENAL, metas: [meta({ id: 'm1', aporteMensual: 400_000 })] }
    const primera = calcularMargen(contexto({ ...base, hoy: '2026-08-05' }))
    const segunda = calcularMargen(contexto({ ...base, hoy: '2026-08-20' }))
    expect(primera.compromisoMeta).toBe(200_000)
    expect(segunda.compromisoMeta).toBe(400_000)
  })

  it('el gasto diario se reparte entre los días que quedan de la quincena', () => {
    const ctx = contexto({
      ajustes: { ...QUINCENAL, ingresoMensual: 3_000_000 },
      hoy: '2026-08-11',
    })
    const margen = calcularMargen(ctx)
    // Del 11 al 15 son 5 días y la quincena aporta 1,500,000.
    expect(margen.diasRestantes).toBe(5)
    expect(margen.gastoDiarioSugerido).toBe(300_000)
  })

  it('un mes pasado se lee completo, no por quincenas', () => {
    const ctx = contexto({
      ajustes: QUINCENAL,
      periodo: '2026-07',
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-03' }),
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-20' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ciclo.tipo).toBe('mensual')
    expect(margen.ingresos).toBe(1_800_000)
    expect(margen.diasRestantes).toBe(0)
  })
})

describe('ingresoTipico', () => {
  it('promedia solo los meses que tuvieron ingreso', () => {
    const historial = [
      transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_000_000, fecha: '2026-07-01' }),
      transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_000_000, fecha: '2026-06-01' }),
    ]
    expect(ingresoTipico(historial, '2026-08')).toBe(1_500_000)
  })

  it('es cero sin historial', () => {
    expect(ingresoTipico([], '2026-08')).toBe(0)
  })
})

describe('evaluarGasto', () => {
  it('da verde a un gasto que cabe en presupuesto y margen', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('verde')
    expect(veredicto.margenDespues).toBe(1_980_000)
  })

  it('pone en rojo el gasto que rebasa el presupuesto de su categoría', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 480_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(50_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'presupuesto-categoria')?.texto).toContain('Te pasas')
  })

  it('avisa en ámbar al acercarse al límite de la categoría', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 380_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(30_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('ambar')
  })

  it('pone en rojo lo que compromete un pago de deuda cercano', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [
        deuda({ acreedor: 'Nu', fechaLimite: '2026-08-16', pagoMinimo: 1_800_000, saldoActual: 2_500_000 }),
      ],
    })
    const veredicto = evaluarGasto(400_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('deuda')
  })

  it('avisa cuando el gasto se come el aporte a metas', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 1_500_000, categoriaId: 'renta' })],
      metas: [meta({ id: 'm1', aporteMensual: 400_000 })],
    })
    const veredicto = evaluarGasto(200_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('metas')
  })

  it('no juzga cuando no hay ingresos con qué medir', () => {
    const ctx = contexto({ transacciones: [transaccion({ monto: 50_000 })] })
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('ambar')
    expect(veredicto.razones.some((r) => r.clave === 'sin-ingresos')).toBe(true)
  })

  it('con monto cero lee el estado general del mes', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 600_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('verde')
    expect(veredicto.margenAntes).toBe(1_400_000)
  })

  it('reporta números rojos en la lectura general cuando el mes ya se pasó', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 2_500_000, categoriaId: 'renta' })],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('números rojos')
  })

  it('en la lectura general habla en presente, no en condicional', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [
        deuda({ acreedor: 'Nu', fechaLimite: '2026-08-16', pagoMinimo: 2_400_000, saldoActual: 2_500_000 }),
      ],
    })
    const texto = evaluarGasto(0, null, ctx).razones.find((r) => r.clave === 'margen')?.texto ?? ''
    expect(texto).toContain('Te faltan')
    expect(texto).not.toContain('quedarías')
  })

  it('respeta el tope global del mes aunque la categoría no tenga presupuesto', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 900_000, categoriaId: 'renta' })],
      presupuestos: [presupuesto({ categoriaId: null, montoLimite: 1_000_000 })],
    })
    const veredicto = evaluarGasto(200_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.some((r) => r.clave === 'presupuesto-global')).toBe(true)
  })

  it('ignora presupuestos de otro periodo', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      presupuestos: [presupuesto({ montoLimite: 1_000, periodo: '2026-07' })],
    })
    expect(evaluarGasto(50_000, 'comida', ctx).nivel).toBe('verde')
  })

  it('menciona el vencimiento más cercano aunque el gasto quepa', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [deuda({ acreedor: 'Nu', fechaLimite: '2026-08-15', pagoMinimo: 100_000 })],
    })
    const veredicto = evaluarGasto(10_000, 'comida', ctx)
    expect(veredicto.razones.find((r) => r.clave === 'vencimiento')?.texto).toContain('Nu')
  })
})

describe('el margen con saldo declarado', () => {
  it('parte del dinero real y no de la resta de flujos', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, saldoInicial: 850_000, saldoInicialFecha: '2026-08-01' },
      transacciones: [transaccion({ monto: 100_000, fecha: '2026-08-05' })],
      deudas: [deuda({ fechaLimite: '2026-08-16', pagoMinimo: 200_000, saldoActual: 900_000 })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.saldo.declarado).toBe(true)
    expect(margen.saldo.actual).toBe(750_000)
    // 750,000 de saldo real − 200,000 comprometidos a deuda.
    expect(margen.margenLibre).toBe(550_000)
  })

  it('sin saldo declarado sigue razonando con los flujos del periodo', () => {
    const ctx = contexto({
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-08-01' }),
        transaccion({ monto: 100_000, fecha: '2026-08-05' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.saldo.declarado).toBe(false)
    expect(margen.margenLibre).toBe(800_000)
  })

  it('los abonos a deuda salen del saldo', () => {
    const base = {
      ajustes: { ...AJUSTES, saldoInicial: 500_000, saldoInicialFecha: '2026-08-01' },
    }
    const sinPago = calcularMargen(contexto(base))
    const conPago = calcularMargen(
      contexto({ ...base, pagos: [pago({ monto: 120_000, fecha: '2026-08-04' })] }),
    )
    expect(sinPago.saldo.actual - conPago.saldo.actual).toBe(120_000)
  })
})
