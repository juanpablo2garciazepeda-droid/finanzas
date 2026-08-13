import { describe, expect, it } from 'vitest'
import { ordenarPorUso } from './categorias'
import { CATEGORIAS, transaccion } from './fixtures'

describe('ordenarPorUso', () => {
  it('pone delante la categoría más usada', () => {
    const movimientos = [
      transaccion({ categoriaId: 'renta', fecha: '2026-08-01' }),
      transaccion({ categoriaId: 'renta', fecha: '2026-08-02' }),
      transaccion({ categoriaId: 'comida', fecha: '2026-08-03' }),
    ]
    expect(ordenarPorUso(CATEGORIAS, movimientos, '2026-06-01').map((c) => c.id)).toEqual([
      'renta',
      'comida',
      'sueldo',
    ])
  })

  it('ignora movimientos anteriores a la ventana', () => {
    const movimientos = [
      transaccion({ categoriaId: 'renta', fecha: '2025-01-01' }),
      transaccion({ categoriaId: 'renta', fecha: '2025-01-02' }),
    ]
    expect(ordenarPorUso(CATEGORIAS, movimientos, '2026-06-01').map((c) => c.id)).toEqual([
      'comida',
      'renta',
      'sueldo',
    ])
  })

  it('sin historial respeta el orden configurado, no el de los ids', () => {
    expect(ordenarPorUso(CATEGORIAS, [], '2026-06-01').map((c) => c.id)).toEqual([
      'comida',
      'renta',
      'sueldo',
    ])
  })

  it('no muta el arreglo original', () => {
    const copia = [...CATEGORIAS]
    ordenarPorUso(CATEGORIAS, [transaccion({ categoriaId: 'renta' })], '2026-01-01')
    expect(CATEGORIAS).toEqual(copia)
  })
})
