import { describe, expect, it } from 'vitest'
import {
  calcularEstados,
  compararPeriodos,
  gastoPorCategoria,
  nivelPorConsumo,
  presupuestosDelPeriodo,
  totalPorTipo,
  transaccionesDelPeriodo,
} from './presupuestos'
import { CATEGORIAS, presupuesto, transaccion } from './fixtures'

describe('nivelPorConsumo', () => {
  it('pasa a rojo al agotar el límite, no antes', () => {
    expect(nivelPorConsumo(0.99, 0.8)).toBe('ambar')
    expect(nivelPorConsumo(1, 0.8)).toBe('rojo')
    expect(nivelPorConsumo(1.4, 0.8)).toBe('rojo')
  })

  it('respeta el umbral configurado', () => {
    expect(nivelPorConsumo(0.7, 0.8)).toBe('verde')
    expect(nivelPorConsumo(0.7, 0.6)).toBe('ambar')
  })
})

describe('gastoPorCategoria', () => {
  it('suma por categoría e ignora los ingresos', () => {
    const gastos = gastoPorCategoria([
      transaccion({ monto: 30_000, categoriaId: 'comida' }),
      transaccion({ monto: 20_000, categoriaId: 'comida' }),
      transaccion({ monto: 90_000, categoriaId: 'renta' }),
      transaccion({ tipo: 'ingreso', monto: 500_000, categoriaId: 'sueldo' }),
    ])
    expect(gastos.get('comida')).toBe(50_000)
    expect(gastos.get('renta')).toBe(90_000)
    expect(gastos.has('sueldo')).toBe(false)
  })

  it('sin movimientos devuelve un mapa vacío', () => {
    expect(gastoPorCategoria([]).size).toBe(0)
  })
})

describe('totalPorTipo', () => {
  it('separa lo que entra de lo que sale', () => {
    const movimientos = [
      transaccion({ tipo: 'ingreso', monto: 800_000 }),
      transaccion({ monto: 120_000 }),
      transaccion({ monto: 80_000 }),
    ]
    expect(totalPorTipo(movimientos, 'ingreso')).toBe(800_000)
    expect(totalPorTipo(movimientos, 'egreso')).toBe(200_000)
  })
})

describe('filtros por periodo', () => {
  it('el mes se decide por la fecha, no por el orden', () => {
    const movimientos = [
      transaccion({ fecha: '2026-07-31' }),
      transaccion({ fecha: '2026-08-01' }),
      transaccion({ fecha: '2026-08-31' }),
      transaccion({ fecha: '2026-09-01' }),
    ]
    expect(transaccionesDelPeriodo(movimientos, '2026-08')).toHaveLength(2)
  })

  it('los presupuestos de otro mes no cuentan', () => {
    const lista = [presupuesto({ periodo: '2026-07' }), presupuesto({ periodo: '2026-08' })]
    expect(presupuestosDelPeriodo(lista, '2026-08')).toHaveLength(1)
  })
})

describe('calcularEstados', () => {
  it('mide cada categoría contra su límite', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: 'comida', montoLimite: 400_000 })],
      [transaccion({ monto: 300_000, categoriaId: 'comida' })],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].gastado).toBe(300_000)
    expect(estados[0].restante).toBe(100_000)
    expect(estados[0].nivel).toBe('verde')
  })

  it('el restante se vuelve negativo al sobregirar, no se recorta a cero', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: 'comida', montoLimite: 100_000 })],
      [transaccion({ monto: 160_000, categoriaId: 'comida' })],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].restante).toBe(-60_000)
    expect(estados[0].nivel).toBe('rojo')
  })

  it('el presupuesto global mide todos los egresos del mes', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: null, montoLimite: 1_000_000 })],
      [
        transaccion({ monto: 300_000, categoriaId: 'comida' }),
        transaccion({ monto: 200_000, categoriaId: 'renta' }),
        transaccion({ tipo: 'ingreso', monto: 900_000, categoriaId: 'sueldo' }),
      ],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].nombre).toBe('Todo el mes')
    expect(estados[0].gastado).toBe(500_000)
  })

  it('una categoría borrada no rompe la lista', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: 'fantasma', montoLimite: 100_000 })],
      [],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].nombre).toBe('Categoría eliminada')
  })

  it('lo más consumido va primero: es lo que hay que ver', () => {
    const estados = calcularEstados(
      [
        presupuesto({ categoriaId: 'comida', montoLimite: 1_000_000 }),
        presupuesto({ categoriaId: 'renta', montoLimite: 100_000 }),
      ],
      [
        transaccion({ monto: 100_000, categoriaId: 'comida' }),
        transaccion({ monto: 95_000, categoriaId: 'renta' }),
      ],
      CATEGORIAS,
      0.8,
    )
    expect(estados[0].categoriaId).toBe('renta')
  })

  it('un límite en cero no produce un consumo infinito', () => {
    const estados = calcularEstados(
      [presupuesto({ categoriaId: 'comida', montoLimite: 0 })],
      [transaccion({ monto: 50_000, categoriaId: 'comida' })],
      CATEGORIAS,
      0.8,
    )
    expect(Number.isFinite(estados[0].consumo)).toBe(true)
  })
})

describe('compararPeriodos', () => {
  it('incluye categorías que solo aparecen en uno de los dos meses', () => {
    const comparativa = compararPeriodos(
      [transaccion({ monto: 50_000, categoriaId: 'comida' })],
      [transaccion({ monto: 80_000, categoriaId: 'renta' })],
      CATEGORIAS,
    )
    expect(comparativa).toHaveLength(2)
  })

  it('sin base de comparación la variación es nula, no infinita', () => {
    const comparativa = compararPeriodos(
      [transaccion({ monto: 50_000, categoriaId: 'comida' })],
      [],
      CATEGORIAS,
    )
    expect(comparativa[0].variacion).toBeNull()
  })

  it('calcula la variación relativa contra el mes anterior', () => {
    const comparativa = compararPeriodos(
      [transaccion({ monto: 150_000, categoriaId: 'comida' })],
      [transaccion({ monto: 100_000, categoriaId: 'comida' })],
      CATEGORIAS,
    )
    expect(comparativa[0].variacion).toBeCloseTo(0.5)
  })
})
