import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estadoIntentos,
  fijarPin,
  hayPin,
  limpiarIntentos,
  pinCorrecto,
  quitarPin,
  registrarFallo,
} from './bloqueo'

/**
 * El entorno de pruebas corre en Node, que no tiene `localStorage`. Se sustituye
 * por un Map. `crypto.subtle` sí existe de forma global desde Node 20, así que
 * el hash se calcula igual que en el navegador.
 */
function almacenFalso(): Storage {
  const datos = new Map<string, string>()
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => void datos.set(clave, String(valor)),
    removeItem: (clave) => void datos.delete(clave),
    clear: () => datos.clear(),
    key: (i) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', almacenFalso())
  vi.stubGlobal('sessionStorage', almacenFalso())
})

describe('pinCorrecto', () => {
  it('acepta el PIN que se fijó', async () => {
    await fijarPin('1234')
    expect(await pinCorrecto('1234')).toBe(true)
  })

  it('rechaza un PIN distinto', async () => {
    await fijarPin('1234')
    expect(await pinCorrecto('9999')).toBe(false)
  })

  it('falla cerrado cuando no hay con qué comparar', async () => {
    // Sin PIN configurado, o con el almacenamiento borrado a mano, validar debe
    // decir que no. Quien decide si hay que pedirlo es hayPin().
    expect(hayPin()).toBe(false)
    expect(await pinCorrecto('1234')).toBe(false)
    expect(await pinCorrecto('')).toBe(false)
  })

  it('deja de aceptar el PIN viejo tras quitarlo', async () => {
    await fijarPin('1234')
    quitarPin()
    expect(hayPin()).toBe(false)
    expect(await pinCorrecto('1234')).toBe(false)
  })

  it('guarda un hash, nunca el PIN en claro', async () => {
    await fijarPin('1234')
    const guardado = JSON.stringify([...Array(localStorage.length)].map((_, i) => localStorage.key(i)))
    expect(guardado).not.toContain('1234')
    expect(localStorage.getItem('finanzas.bloqueo.hash')).not.toContain('1234')
  })

  it('dos personas con el mismo PIN producen hashes distintos', async () => {
    await fijarPin('1234')
    const primero = localStorage.getItem('finanzas.bloqueo.hash')
    vi.stubGlobal('localStorage', almacenFalso())
    await fijarPin('1234')
    // La sal aleatoria es lo que impide reconocer PINes iguales entre sí.
    expect(localStorage.getItem('finanzas.bloqueo.hash')).not.toBe(primero)
  })
})

describe('límite de intentos', () => {
  it('los primeros fallos no imponen espera', () => {
    for (let i = 0; i < 4; i++) registrarFallo()
    expect(estadoIntentos().esperaRestante).toBe(0)
    expect(estadoIntentos().intentosFallidos).toBe(4)
  })

  it('al quinto fallo empieza la espera', () => {
    for (let i = 0; i < 5; i++) registrarFallo()
    const estado = estadoIntentos()
    expect(estado.esperaRestante).toBeGreaterThan(0)
    expect(estado.esperaRestante).toBeLessThanOrEqual(30)
  })

  it('cada tanda fallida duplica la espera', () => {
    for (let i = 0; i < 5; i++) registrarFallo()
    const primera = estadoIntentos().esperaRestante
    for (let i = 0; i < 5; i++) registrarFallo()
    const segunda = estadoIntentos().esperaRestante
    expect(segunda).toBeGreaterThan(primera)
  })

  it('entrar bien limpia la cuenta', () => {
    for (let i = 0; i < 6; i++) registrarFallo()
    limpiarIntentos()
    expect(estadoIntentos()).toEqual({ esperaRestante: 0, intentosFallidos: 0 })
  })

  it('la cuenta sobrevive a recargar la página', () => {
    for (let i = 0; i < 3; i++) registrarFallo()
    // Recargar limpia sessionStorage pero no localStorage: si el contador
    // viviera en el primero, la espera no serviría de nada.
    sessionStorage.clear()
    expect(estadoIntentos().intentosFallidos).toBe(3)
  })
})
