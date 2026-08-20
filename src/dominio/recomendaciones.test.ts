import { describe, expect, it } from 'vitest'
import { generarRecomendaciones } from './recomendaciones'
import { AJUSTES, CATEGORIAS, contexto, deuda, meta, presupuesto, transaccion } from './fixtures'

const SUELDO = transaccion({
  tipo: 'ingreso',
  categoriaId: 'sueldo',
  monto: 2_000_000,
  fecha: '2026-08-01',
})

/** Ids de las recomendaciones que produjo un contexto. */
function claves(ctx: Parameters<typeof generarRecomendaciones>[0]) {
  return generarRecomendaciones(ctx, []).map((r) => r.id)
}

describe('recomendaciones de deuda', () => {
  it('avisa cuando una deuda está a uno o dos pagos de liquidarse', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [deuda({ id: 'd1', acreedor: 'Mi tío', saldoActual: 100_000, pagoMinimo: 100_000 })],
    })
    const casi = generarRecomendaciones(ctx, []).find((r) => r.id === 'casi-d1')
    expect(casi).toBeDefined()
    expect(casi?.detalle).toContain('libera')
  })

  it('no la marca como casi liquidada si aún faltan muchos pagos', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [deuda({ id: 'd1', saldoActual: 2_000_000, pagoMinimo: 100_000 })],
    })
    expect(claves(ctx)).not.toContain('casi-d1')
  })
})

describe('recomendaciones de hábito', () => {
  it('detecta que el gasto va más rápido que el tiempo del ciclo', () => {
    const ctx = contexto({
      // Día 3 de 31 y ya se fue el 60% del ingreso.
      hoy: '2026-08-03',
      transacciones: [SUELDO, transaccion({ monto: 1_200_000, fecha: '2026-08-02' })],
    })
    expect(claves(ctx)).toContain('ritmo-ciclo')
  })

  it('no lo dice si el gasto va acorde al tiempo corrido', () => {
    const ctx = contexto({
      hoy: '2026-08-16',
      transacciones: [SUELDO, transaccion({ monto: 900_000, fecha: '2026-08-05' })],
    })
    expect(claves(ctx)).not.toContain('ritmo-ciclo')
  })

  it('anualiza las suscripciones', () => {
    const ctx = contexto({
      categorias: [
        ...CATEGORIAS,
        {
          id: 'susc',
          nombre: 'Suscripciones',
          tipo: 'egreso' as const,
          icono: 'Repeat',
          color: '#10924B',
          esSistema: true,
          archivada: false,
          orden: 9,
        },
      ],
      transacciones: [SUELDO, transaccion({ categoriaId: 'susc', monto: 45_000, fecha: '2026-08-04' })],
    })
    const r = generarRecomendaciones(ctx, []).find((x) => x.id === 'suscripciones-anuales')
    expect(r?.titulo).toContain('5,400')
  })

  it('avisa cuando más de la mitad del gasto va a crédito', () => {
    const ctx = contexto({
      transacciones: [
        SUELDO,
        transaccion({ monto: 600_000, metodoPago: 'credito', fecha: '2026-08-04' }),
        transaccion({ monto: 200_000, metodoPago: 'debito', fecha: '2026-08-05' }),
      ],
    })
    expect(claves(ctx)).toContain('mucho-credito')
  })
})

describe('recomendaciones de presupuesto y metas', () => {
  it('sugiere ponerle tope a una categoría pesada que no lo tiene', () => {
    const ctx = contexto({
      transacciones: [
        SUELDO,
        transaccion({ categoriaId: 'renta', monto: 800_000, fecha: '2026-08-02' }),
        transaccion({ categoriaId: 'comida', monto: 100_000, fecha: '2026-08-03' }),
      ],
      presupuestos: [presupuesto({ categoriaId: 'comida' })],
    })
    expect(claves(ctx)).toContain('sin-tope-renta')
  })

  it('no lo sugiere si la categoría ya tiene presupuesto', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ categoriaId: 'comida', monto: 800_000, fecha: '2026-08-02' })],
      presupuestos: [presupuesto({ categoriaId: 'comida', montoLimite: 900_000 })],
    })
    expect(claves(ctx)).not.toContain('sin-tope-comida')
  })

  it('propone un fondo de emergencia cuando no existe', () => {
    const ctx = contexto({
      transacciones: [
        SUELDO,
        transaccion({ monto: 500_000, fecha: '2026-06-10' }),
        transaccion({ monto: 500_000, fecha: '2026-07-10' }),
      ],
    })
    const r = generarRecomendaciones(ctx, []).find((x) => x.id === 'sin-fondo-emergencia')
    expect(r?.detalle).toContain('15,000')
  })

  it('no lo propone si ya hay una meta de emergencia', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 500_000, fecha: '2026-07-10' })],
      metas: [meta({ nombre: 'Fondo de emergencia' })],
    })
    expect(claves(ctx)).not.toContain('sin-fondo-emergencia')
  })
})

describe('recomendaciones positivas', () => {
  it('reconoce cuando se gasta menos que el mes anterior', () => {
    const ctx = contexto({
      transacciones: [
        SUELDO,
        transaccion({ monto: 1_000_000, fecha: '2026-07-10' }),
        transaccion({ monto: 400_000, fecha: '2026-08-10' }),
      ],
    })
    const r = generarRecomendaciones(ctx, []).find((x) => x.id === 'vas-mejor')
    expect(r?.titulo).toContain('6,000')
    expect(r?.titulo).toContain('julio')
  })
})

describe('orden de la lista', () => {
  it('lo urgente va primero', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 2_500_000, categoriaId: 'renta', fecha: '2026-08-02' })],
      deudas: [deuda({ saldoActual: 100_000, pagoMinimo: 4_000, tasaInteres: 60 })],
    })
    const lista = generarRecomendaciones(ctx, [])
    expect(lista.length).toBeGreaterThan(1)
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i].prioridad).toBeGreaterThanOrEqual(lista[i - 1].prioridad)
    }
  })
})

describe('los umbrales escalan con el ingreso', () => {
  /** Ocho cafés de $120: hormiga para quien gana mucho, gasto real para quien no. */
  const CAFES = Array.from({ length: 8 }, (_, i) =>
    transaccion({ monto: 12_000, fecha: `2026-08-0${i + 1}` }),
  )

  it('con ingreso alto, ocho gastos de $120 son hormiga', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 5_000_000 },
      transacciones: CAFES,
    })
    const r = generarRecomendaciones(ctx, []).find((x) => x.id.startsWith('hormiga-'))
    expect(r).toBeDefined()
  })

  it('con ingreso bajo, los mismos gastos ya no son "chicos"', () => {
    // $120 es el 0.7% de un ingreso de 17,000: pasa el 2%, así que deja de
    // contar como hormiga y no se agrupa como ruido.
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 400_000 },
      transacciones: CAFES,
    })
    const r = generarRecomendaciones(ctx, []).find((x) => x.id.startsWith('hormiga-'))
    expect(r).toBeUndefined()
  })

  it('sin ingreso configurado se aplica el piso, no cero', () => {
    // Sin referencia, un umbral proporcional sería cero y marcaría todo.
    const ctx = contexto({ transacciones: CAFES })
    const lista = generarRecomendaciones(ctx, [])
    expect(lista.every((r) => !r.id.startsWith('hormiga-'))).toBe(true)
  })

  it('el excedente relevante crece con el sueldo', () => {
    const base = {
      transacciones: [transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 3_000_000, fecha: '2026-08-01' })],
      metas: [meta({ id: 'm1', aporteMensual: 0, fechaLimite: '2026-12-01' })],
    }
    const modesto = generarRecomendaciones(
      contexto({ ...base, ajustes: { ...AJUSTES, ingresoMensual: 3_000_000 } }),
      [],
    )
    // 3,000,000 libres superan el 5% de 3,000,000: se sugiere destino.
    expect(modesto.some((r) => r.id === 'excedente-meta')).toBe(true)
  })
})

describe('las recomendaciones no reparten dinero que no está en la cuenta', () => {
  it('no propone abonar el excedente del ciclo cuando la cuenta no lo respalda', () => {
    // Flujo del ciclo: $6,500 libres. Cuenta: $27 y una deuda por vencer.
    // Sugerir "abona tus $6,500 libres" con esa cuenta es un mal consejo.
    const ctx = contexto({
      hoy: '2026-08-20',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_900_000,
        saldoInicial: 2_700,
        saldoInicialFecha: '2026-08-16',
      },
      deudas: [deuda({ id: 'd1', pagoMinimo: 300_000, fechaLimite: '2026-08-25' })],
    })

    expect(claves(ctx)).not.toContain('excedente-deuda')
  })
})
