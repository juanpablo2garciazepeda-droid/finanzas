import { describe, expect, it } from 'vitest'
import {
  aFechaLocal,
  diasEntre,
  diasRestantesDelPeriodo,
  enDias,
  fechaRelativa,
  mesesEntre,
  periodoDe,
  periodoMasAntiguo,
  rangoPeriodo,
  siguienteOcurrencia,
  sumarMeses,
  periodoActual,
  ultimosPeriodos,
} from './fechas'

describe('aFechaLocal', () => {
  it('interpreta la fecha en hora local, no en UTC', () => {
    // new Date('2026-08-31') daría el 30 de agosto en husos al oeste de Greenwich.
    const fecha = aFechaLocal('2026-08-31')
    expect(fecha.getDate()).toBe(31)
    expect(fecha.getMonth()).toBe(7)
  })
})

describe('periodos', () => {
  it('extrae el periodo de una fecha', () => {
    expect(periodoDe('2026-08-13')).toBe('2026-08')
  })

  it('cruza el año al sumar meses', () => {
    expect(sumarMeses('2026-11', 3)).toBe('2027-02')
    expect(sumarMeses('2026-02', -3)).toBe('2025-11')
  })

  it('lista los últimos periodos del más viejo al más nuevo', () => {
    expect(ultimosPeriodos('2026-03', 3)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('cierra el rango en el último día real del mes', () => {
    expect(rangoPeriodo('2026-02')).toEqual({ inicio: '2026-02-01', fin: '2026-02-28' })
    expect(rangoPeriodo('2024-02').fin).toBe('2024-02-29')
    expect(rangoPeriodo('2026-08').fin).toBe('2026-08-31')
  })
})

describe('diasEntre', () => {
  it('cuenta días hacia adelante y hacia atrás', () => {
    expect(diasEntre('2026-08-13', '2026-08-20')).toBe(7)
    expect(diasEntre('2026-08-20', '2026-08-13')).toBe(-7)
  })

  it('no se descuadra al cruzar el cambio de horario', () => {
    // Si se restaran timestamps sin normalizar, aquí saldría 30.958…
    expect(diasEntre('2026-03-20', '2026-04-20')).toBe(31)
  })
})

describe('mesesEntre', () => {
  it('cuenta meses calendario', () => {
    expect(mesesEntre('2026-08-13', '2026-12-01')).toBe(4)
    expect(mesesEntre('2026-08-13', '2026-08-28')).toBe(0)
  })
})

describe('diasRestantesDelPeriodo', () => {
  it('incluye el día de hoy', () => {
    expect(diasRestantesDelPeriodo('2026-08-31')).toBe(1)
    expect(diasRestantesDelPeriodo('2026-08-01')).toBe(31)
  })
})

describe('siguienteOcurrencia', () => {
  it('adelanta un pago mensual vencido conservando el día del mes', () => {
    expect(siguienteOcurrencia('2026-06-05', 'mensual', '2026-08-13')).toBe('2026-09-05')
  })

  it('deja intacto un pago futuro', () => {
    expect(siguienteOcurrencia('2026-09-05', 'mensual', '2026-08-13')).toBe('2026-09-05')
  })

  it('no mueve las deudas de pago único aunque estén vencidas', () => {
    expect(siguienteOcurrencia('2026-01-10', 'unico', '2026-08-13')).toBe('2026-01-10')
  })

  it('avanza los semanales de siete en siete', () => {
    expect(siguienteOcurrencia('2026-08-01', 'semanal', '2026-08-13')).toBe('2026-08-15')
  })
})

describe('enDias', () => {
  it('usa singular con un día', () => {
    expect(enDias(1)).toBe('1 día')
  })

  it('usa plural con cero y con varios', () => {
    expect(enDias(0)).toBe('0 días')
    expect(enDias(2)).toBe('2 días')
    expect(enDias(30)).toBe('30 días')
  })
})

describe('fechaRelativa', () => {
  it('nombra hoy, mañana y ayer en vez de contar días', () => {
    expect(fechaRelativa('2026-08-13', '2026-08-13')).toBe('hoy')
    expect(fechaRelativa('2026-08-13', '2026-08-14')).toBe('mañana')
    expect(fechaRelativa('2026-08-13', '2026-08-12')).toBe('ayer')
  })

  it('concuerda el plural en ambas direcciones', () => {
    expect(fechaRelativa('2026-08-13', '2026-08-15')).toBe('en 2 días')
    expect(fechaRelativa('2026-08-13', '2026-08-11')).toBe('hace 2 días')
  })
})

describe('periodoMasAntiguo', () => {
  it('sin ninguna fecha, el suelo es el mes en curso', () => {
    expect(periodoMasAntiguo([])).toBe(periodoActual())
  })

  it('devuelve el periodo de la fecha más vieja', () => {
    expect(periodoMasAntiguo(['2026-08-19', '2025-03-02', '2026-01-31'])).toBe('2025-03')
  })

  it('no le importa el orden en que lleguen', () => {
    expect(periodoMasAntiguo(['2024-12-31', '2026-08-01'])).toBe(
      periodoMasAntiguo(['2026-08-01', '2024-12-31']),
    )
  })

  it('ignora vacíos y nulos, que es lo que manda un saldo inicial sin fecha', () => {
    expect(periodoMasAntiguo(['', '2025-06-10', undefined, null])).toBe('2025-06')
  })

  it('si solo hay vacíos, cae en el mes en curso', () => {
    expect(periodoMasAntiguo(['', undefined])).toBe(periodoActual())
  })

  it('un CSV con movimientos de hace años baja el suelo hasta allá', () => {
    expect(periodoMasAntiguo(['2019-02-14', '2026-08-19'])).toBe('2019-02')
  })

  it('nunca devuelve un periodo futuro: se queda en el mes en curso', () => {
    // Una fecha capturada mal (un dedazo en el año) no debe abrir meses
    // que todavía no llegan.
    const futuro = sumarMeses(periodoActual(), 6) + '-15'
    expect(periodoMasAntiguo([futuro])).toBe(periodoActual())
  })
})
