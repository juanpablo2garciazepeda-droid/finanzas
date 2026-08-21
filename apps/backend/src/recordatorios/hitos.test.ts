import { describe, expect, it } from 'vitest'
import { comoTexto, diasEntre, fmtMoneda, hitoDe, siguienteOcurrencia } from './hitos'

describe('fechas del recordatorio', () => {
  it('cuenta días sin caer en la trampa de la zona horaria', () => {
    // `new Date('2026-08-01')` es UTC y en México cae el 31 de julio: un pago
    // del día 1 avisaría un día antes de tiempo, todos los meses.
    expect(diasEntre('2026-08-01', '2026-08-08')).toBe(7)
    expect(diasEntre('2026-08-08', '2026-08-01')).toBe(-7)
    expect(diasEntre('2026-08-31', '2026-09-01')).toBe(1)
  })

  it('un pago mensual avanza por mes calendario, no por 30 días', () => {
    expect(siguienteOcurrencia('2026-01-31', 'mensual', '2026-03-10')).toBe('2026-03-31')
    expect(siguienteOcurrencia('2026-08-05', 'mensual', '2026-08-20')).toBe('2026-09-05')
  })

  it('un pago único vencido sigue vencido', () => {
    expect(siguienteOcurrencia('2026-07-01', 'unico', '2026-08-21')).toBe('2026-07-01')
  })

  it('no adelanta una fecha que todavía no llega', () => {
    expect(siguienteOcurrencia('2026-08-25', 'mensual', '2026-08-21')).toBe('2026-08-25')
  })
})

describe('hitos de aviso', () => {
  it('avisa al entrar en la ventana, el día del vencimiento y al pasarse', () => {
    expect(hitoDe(7, 7)).toBe('previo')
    expect(hitoDe(1, 7)).toBe('previo')
    expect(hitoDe(0, 7)).toBe('hoy')
    expect(hitoDe(-1, 7)).toBe('vencido')
  })

  it('fuera de la ventana no avisa nada', () => {
    expect(hitoDe(8, 7)).toBeNull()
    expect(hitoDe(30, 7)).toBeNull()
  })

  it('el mismo hito en días distintos sigue siendo el mismo, así no se repite', () => {
    // Es lo que hace que un pago vencido no mande correo todos los días.
    expect(hitoDe(-1, 7)).toBe(hitoDe(-9, 7))
  })
})

describe('texto y formato del correo', () => {
  it('nombra el momento en palabras, no en número de días crudo', () => {
    expect(comoTexto(1)).toBe('vence en 1 día')
    expect(comoTexto(3)).toBe('vence en 3 días')
    expect(comoTexto(0)).toBe('vence hoy')
    expect(comoTexto(-2)).toBe('venció hace 2 días')
  })

  it('muestra centavos solo cuando existen', () => {
    expect(fmtMoneda(350, 'MXN', 'es-MX')).toBe('$3.50')
    expect(fmtMoneda(300_000, 'MXN', 'es-MX')).toBe('$3,000')
  })
})
