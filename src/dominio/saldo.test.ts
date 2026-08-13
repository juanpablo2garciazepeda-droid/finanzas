import { describe, expect, it } from 'vitest'
import { calcularSaldo } from './saldo'
import { aporte, pago, transaccion } from './fixtures'

describe('calcularSaldo', () => {
  it('parte de la foto y resta lo que salió', () => {
    const saldo = calcularSaldo(
      850_000,
      '2026-08-01',
      [
        transaccion({ monto: 120_000, fecha: '2026-08-05' }),
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 50_000, fecha: '2026-08-06' }),
      ],
      [pago({ monto: 200_000, fecha: '2026-08-07' })],
      [aporte({ monto: 30_000, fecha: '2026-08-08' })],
    )
    // 850,000 + 50,000 − 120,000 − 200,000 − 30,000
    expect(saldo.actual).toBe(550_000)
    expect(saldo.declarado).toBe(true)
  })

  it('ignora lo anterior a la foto: ese dinero ya está dentro del saldo', () => {
    const saldo = calcularSaldo(
      850_000,
      '2026-08-01',
      [transaccion({ monto: 400_000, fecha: '2026-07-20' })],
      [pago({ monto: 900_000, fecha: '2026-07-15' })],
      [],
    )
    expect(saldo.actual).toBe(850_000)
  })

  it('cuenta lo del mismo día de la foto', () => {
    const saldo = calcularSaldo(
      100_000,
      '2026-08-01',
      [transaccion({ monto: 40_000, fecha: '2026-08-01' })],
      [],
      [],
    )
    expect(saldo.actual).toBe(60_000)
  })

  it('sin fecha no hay saldo declarado', () => {
    const saldo = calcularSaldo(850_000, '', [], [], [])
    expect(saldo.declarado).toBe(false)
    expect(saldo.actual).toBe(0)
  })

  it('puede quedar en negativo si se gastó de más', () => {
    const saldo = calcularSaldo(
      50_000,
      '2026-08-01',
      [transaccion({ monto: 90_000, fecha: '2026-08-03' })],
      [],
      [],
    )
    expect(saldo.actual).toBe(-40_000)
  })
})
