import { describe, expect, it } from 'vitest'
import { cicloDe } from './ciclos'

describe('cicloDe mensual', () => {
  it('cubre el mes completo', () => {
    const c = cicloDe('2026-08-13', 'mensual')
    expect(c.inicio).toBe('2026-08-01')
    expect(c.fin).toBe('2026-08-31')
    expect(c.diasTotales).toBe(31)
    expect(c.diasRestantes).toBe(19)
    expect(c.porMes).toBe(1)
  })
})

describe('cicloDe quincenal', () => {
  it('del 1 al 15 en la primera mitad', () => {
    const c = cicloDe('2026-08-07', 'quincenal')
    expect(c.inicio).toBe('2026-08-01')
    expect(c.fin).toBe('2026-08-15')
    expect(c.diasRestantes).toBe(9)
    expect(c.restantesEnMes).toBe(2)
  })

  it('del 16 al último día en la segunda mitad', () => {
    const c = cicloDe('2026-08-20', 'quincenal')
    expect(c.inicio).toBe('2026-08-16')
    expect(c.fin).toBe('2026-08-31')
    expect(c.restantesEnMes).toBe(1)
  })

  it('el día 15 todavía es primera quincena', () => {
    expect(cicloDe('2026-08-15', 'quincenal').fin).toBe('2026-08-15')
    expect(cicloDe('2026-08-15', 'quincenal').diasRestantes).toBe(1)
  })

  it('respeta meses cortos', () => {
    expect(cicloDe('2026-02-20', 'quincenal').fin).toBe('2026-02-28')
    expect(cicloDe('2024-02-20', 'quincenal').fin).toBe('2024-02-29')
  })
})

describe('cicloDe semanal', () => {
  it('va de lunes a domingo', () => {
    // 2026-08-13 es jueves.
    const c = cicloDe('2026-08-13', 'semanal')
    expect(c.inicio).toBe('2026-08-10')
    expect(c.fin).toBe('2026-08-16')
    expect(c.diasTotales).toBe(7)
    expect(c.diasRestantes).toBe(4)
  })

  it('el domingo cierra su propia semana, no abre la siguiente', () => {
    const c = cicloDe('2026-08-16', 'semanal')
    expect(c.inicio).toBe('2026-08-10')
    expect(c.fin).toBe('2026-08-16')
    expect(c.diasRestantes).toBe(1)
  })

  it('el lunes abre semana completa', () => {
    const c = cicloDe('2026-08-10', 'semanal')
    expect(c.inicio).toBe('2026-08-10')
    expect(c.diasRestantes).toBe(7)
  })
})
