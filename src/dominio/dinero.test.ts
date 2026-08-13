import { describe, expect, it } from 'vitest'
import { aCentavos, formatearMoneda, fraccion, sumar } from './dinero'

describe('aCentavos', () => {
  it('convierte texto con separadores a centavos', () => {
    expect(aCentavos('1,234.56')).toBe(123456)
    expect(aCentavos('$980')).toBe(98000)
    expect(aCentavos('0.1')).toBe(10)
  })

  it('redondea en vez de truncar', () => {
    expect(aCentavos('10.005')).toBe(1001)
    expect(aCentavos(33.333)).toBe(3333)
  })

  it('devuelve cero ante entradas vacías o basura', () => {
    expect(aCentavos('')).toBe(0)
    expect(aCentavos('abc')).toBe(0)
    expect(aCentavos('.')).toBe(0)
    expect(aCentavos(Number.NaN)).toBe(0)
  })
})

describe('sumar en centavos', () => {
  it('no arrastra el error de coma flotante que sí tienen los pesos', () => {
    // 0.1 + 0.2 en pesos da 0.30000000000000004; en centavos da 30 exacto.
    expect(sumar([10, 20])).toBe(30)
    expect(sumar([aCentavos('19.99'), aCentavos('0.01')])).toBe(2000)
  })
})

describe('fraccion', () => {
  it('mide consumo contra un límite', () => {
    expect(fraccion(50, 200)).toBe(0.25)
    expect(fraccion(300, 200)).toBe(1.5)
  })

  it('trata el límite cero como consumido cuando ya hay gasto', () => {
    expect(fraccion(100, 0)).toBe(1)
    expect(fraccion(0, 0)).toBe(0)
  })
})

describe('formatearMoneda', () => {
  it('formatea pesos mexicanos', () => {
    expect(formatearMoneda(123456, 'MXN', 'es-MX')).toContain('1,234.56')
  })

  it('puede omitir decimales', () => {
    const texto = formatearMoneda(123456, 'MXN', 'es-MX', { conDecimales: false })
    expect(texto).not.toContain('.56')
  })
})
