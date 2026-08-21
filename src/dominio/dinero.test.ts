import { describe, expect, it } from 'vitest'
import { aCentavos, formatearMoneda, fraccion, sumar, tieneCentavos } from './dinero'

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

describe('los centavos no se inventan ni se pierden', () => {
  it('parsea decimales sobre el texto y no sobre un float', () => {
    expect(aCentavos('3.50')).toBe(350)
    expect(aCentavos('3.5')).toBe(350)
    expect(aCentavos('0.01')).toBe(1)
    expect(aCentavos('1,234.56')).toBe(123456)
    // El tercer decimal decide el redondeo, sin pasar por el binario.
    expect(aCentavos('3.545')).toBe(355)
    expect(aCentavos('3.544')).toBe(354)
    expect(aCentavos('-12.30')).toBe(-1230)
    expect(aCentavos('.75')).toBe(75)
  })

  it('en modo auto muestra los centavos solo cuando existen', () => {
    // El bug: declarar $3.50 de saldo y ver "$4" en el tablero. Redondear
    // hacia arriba medio peso hace que la app parezca no estar escuchando.
    expect(formatearMoneda(350, 'MXN', 'es-MX', { conDecimales: 'auto' })).toBe('$3.50')
    expect(formatearMoneda(400, 'MXN', 'es-MX', { conDecimales: 'auto' })).toBe('$4')
    expect(formatearMoneda(123456, 'MXN', 'es-MX', { conDecimales: 'auto' })).toBe('$1,234.56')
  })

  it('tieneCentavos distingue el monto redondo del que no lo es', () => {
    expect(tieneCentavos(350)).toBe(true)
    expect(tieneCentavos(400)).toBe(false)
    expect(tieneCentavos(-350)).toBe(true)
    expect(tieneCentavos(0)).toBe(false)
  })
})
