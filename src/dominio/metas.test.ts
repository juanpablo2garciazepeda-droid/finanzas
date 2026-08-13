import { describe, expect, it } from 'vitest'
import { compromisoMetas, proyectarMeta } from './metas'
import { aporte, meta } from './fixtures'

describe('proyectarMeta', () => {
  it('proyecta la llegada con el ritmo de los últimos tres meses', () => {
    const m = meta({ id: 'm1', montoObjetivo: 1_000_000, montoActual: 400_000 })
    const aportes = [
      aporte({ metaId: 'm1', monto: 200_000, fecha: '2026-06-05' }),
      aporte({ metaId: 'm1', monto: 200_000, fecha: '2026-07-05' }),
      aporte({ metaId: 'm1', monto: 200_000, fecha: '2026-08-05' }),
    ]
    const proyeccion = proyectarMeta(m, aportes, '2026-08-13')
    expect(proyeccion.ritmoMensual).toBe(200_000)
    expect(proyeccion.mesesAlObjetivo).toBe(3)
    expect(proyeccion.periodoProyectado).toBe('2026-11')
    expect(proyeccion.avance).toBeCloseTo(0.4)
  })

  it('usa el plan mensual mientras no haya aportes', () => {
    const m = meta({ montoObjetivo: 1_000_000, montoActual: 0, aporteMensual: 250_000 })
    expect(proyectarMeta(m, [], '2026-08-13').mesesAlObjetivo).toBe(4)
  })

  it('marca en riesgo la meta que no llega a la fecha límite', () => {
    const m = meta({
      id: 'm2',
      montoObjetivo: 1_000_000,
      montoActual: 100_000,
      aporteMensual: 50_000,
      fechaLimite: '2026-12-01',
    })
    const proyeccion = proyectarMeta(m, [], '2026-08-13')
    expect(proyeccion.enRiesgo).toBe(true)
    expect(proyeccion.aporteNecesario).toBe(180_000)
  })

  it('no marca en riesgo la meta que va sobrada', () => {
    const m = meta({
      montoObjetivo: 1_000_000,
      montoActual: 900_000,
      aporteMensual: 100_000,
      fechaLimite: '2027-01-01',
    })
    expect(proyectarMeta(m, [], '2026-08-13').enRiesgo).toBe(false)
  })

  it('detecta la meta ya vencida sin completar', () => {
    const m = meta({ montoObjetivo: 500_000, montoActual: 100_000, fechaLimite: '2026-06-01' })
    expect(proyectarMeta(m, [], '2026-08-13').vencida).toBe(true)
  })

  it('no pide nada si ya se alcanzó el objetivo', () => {
    const m = meta({ montoObjetivo: 500_000, montoActual: 500_000 })
    const proyeccion = proyectarMeta(m, [], '2026-08-13')
    expect(proyeccion.faltante).toBe(0)
    expect(proyeccion.mesesAlObjetivo).toBe(0)
    expect(proyeccion.enRiesgo).toBe(false)
  })
})

describe('compromisoMetas', () => {
  it('suma lo que falta apartar este mes', () => {
    const metas = [meta({ id: 'm1', aporteMensual: 200_000 }), meta({ id: 'm2', aporteMensual: 100_000 })]
    const aportes = [aporte({ metaId: 'm1', monto: 50_000, fecha: '2026-08-04' })]
    expect(compromisoMetas(metas, aportes, '2026-08')).toBe(250_000)
  })

  it('no pide más de lo que falta para completar la meta', () => {
    const metas = [meta({ id: 'm1', montoObjetivo: 500_000, montoActual: 470_000, aporteMensual: 200_000 })]
    expect(compromisoMetas(metas, [], '2026-08')).toBe(30_000)
  })

  it('ignora las metas completadas', () => {
    const metas = [meta({ id: 'm1', aporteMensual: 200_000, completada: true })]
    expect(compromisoMetas(metas, [], '2026-08')).toBe(0)
  })

  it('ignora aportes de otro mes', () => {
    const metas = [meta({ id: 'm1', aporteMensual: 200_000 })]
    const aportes = [aporte({ metaId: 'm1', monto: 200_000, fecha: '2026-07-04' })]
    expect(compromisoMetas(metas, aportes, '2026-08')).toBe(200_000)
  })
})
