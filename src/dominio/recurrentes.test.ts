import { describe, expect, it } from 'vitest'
import { egresosFijosPendientes, ingresosProgramados, ocurrenciasEnVentana } from './recurrentes'
import { recurrente } from './fixtures'

describe('ocurrenciasEnVentana', () => {
  it('toma la fecha del mes que cae dentro de la ventana', () => {
    expect(ocurrenciasEnVentana(recurrente({ diaDelMes: 5 }), '2026-08-01', '2026-08-15')).toEqual([
      '2026-08-05',
    ])
  })

  it('mira también el mes siguiente, porque la semana cruza el cambio de mes', () => {
    // Semana del 29 de agosto al 4 de septiembre: la renta del día 1 cae ahí.
    expect(ocurrenciasEnVentana(recurrente({ diaDelMes: 1 }), '2026-08-29', '2026-09-04')).toEqual([
      '2026-09-01',
    ])
  })

  it('ignora lo que ya pasó dentro de la ventana', () => {
    expect(ocurrenciasEnVentana(recurrente({ diaDelMes: 5 }), '2026-08-10', '2026-08-31')).toEqual([])
  })

  it('respeta el inicio y el fin de la plantilla', () => {
    const antes = recurrente({ diaDelMes: 5, iniciaEn: '2026-09-01' })
    expect(ocurrenciasEnVentana(antes, '2026-08-01', '2026-08-31')).toEqual([])

    const terminada = recurrente({ diaDelMes: 5, terminaEn: '2026-07-31' })
    expect(ocurrenciasEnVentana(terminada, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('no cuenta la ocurrencia que el backend ya convirtió en movimiento', () => {
    // Si ya se generó, el gasto está registrado como transacción: sumarlo
    // otra vez lo cobraría dos veces contra el mismo margen.
    const generada = recurrente({ diaDelMes: 5, ultimoGeneradoEn: '2026-08-05' })
    expect(ocurrenciasEnVentana(generada, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('una plantilla apagada no compromete nada', () => {
    expect(egresosFijosPendientes([recurrente({ activo: false })], '2026-08-01', '2026-08-31')).toBe(0)
  })
})

describe('compromisos y entradas con plantilla', () => {
  it('suma los gastos fijos que aún no se cobran', () => {
    const plantillas = [
      recurrente({ diaDelMes: 5, monto: 600_000 }),
      recurrente({ diaDelMes: 10, monto: 40_000 }),
      recurrente({ diaDelMes: 20, monto: 15_000 }),
    ]
    expect(egresosFijosPendientes(plantillas, '2026-08-08', '2026-08-31')).toBe(55_000)
  })

  it('un ingreso con plantilla dice cuánto entra y qué día', () => {
    const plantillas = [
      recurrente({ tipo: 'ingreso', diaDelMes: 15, monto: 950_000, categoriaId: 'sueldo' }),
      recurrente({ tipo: 'egreso', diaDelMes: 5, monto: 600_000 }),
    ]
    expect(ingresosProgramados(plantillas, '2026-08-01', '2026-08-31')).toEqual({
      total: 950_000,
      fecha: '2026-08-15',
    })
  })

  it('sin plantillas de ingreso no inventa una fecha', () => {
    expect(ingresosProgramados([], '2026-08-01', '2026-08-31')).toEqual({ total: 0, fecha: null })
  })
})
