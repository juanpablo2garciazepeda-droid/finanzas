import { describe, expect, it } from 'vitest'
import { calcularMargen, evaluarGasto, ingresoTipico, peorNivel } from './alertas'
import { AJUSTES, contexto, deuda, meta, pago, presupuesto, transaccion } from './fixtures'

const SUELDO = transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_000_000, fecha: '2026-08-01' })

describe('peorNivel', () => {
  it('se queda con el nivel más grave', () => {
    expect(peorNivel(['verde', 'ambar', 'verde'])).toBe('ambar')
    expect(peorNivel(['ambar', 'rojo'])).toBe('rojo')
    expect(peorNivel([])).toBe('verde')
  })
})

describe('calcularMargen', () => {
  it('resta deudas próximas y aportes pendientes del balance', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 500_000 })],
      deudas: [deuda({ fechaLimite: '2026-08-15', pagoMinimo: 300_000 })],
      metas: [meta({ id: 'm1', aporteMensual: 200_000 })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.egresos).toBe(500_000)
    expect(margen.flujoDelCiclo).toBe(1_500_000)
    expect(margen.compromisoDeuda).toBe(300_000)
    expect(margen.compromisoMeta).toBe(200_000)
    expect(margen.margenLibre).toBe(1_000_000)
  })

  it('descuenta del compromiso de meta lo ya aportado en el mes', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      metas: [meta({ id: 'm1', aporteMensual: 200_000 })],
      aportes: [{ id: 'a1', metaId: 'm1', monto: 150_000, fecha: '2026-08-03', nota: '' }],
    })
    expect(calcularMargen(ctx).compromisoMeta).toBe(50_000)
  })

  it('reparte el margen entre los días que quedan del mes', () => {
    const ctx = contexto({ transacciones: [SUELDO] })
    const margen = calcularMargen(ctx)
    expect(margen.diasRestantes).toBe(19)
    expect(margen.gastoDiarioSugerido).toBe(Math.floor(2_000_000 / 19))
  })

  it('usa el sueldo configurado mientras no cae la nómina del mes', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [transaccion({ monto: 100_000, fecha: '2026-08-02' })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_500_000)
    expect(margen.ingresosEstimados).toBe(true)
    expect(margen.flujoDelCiclo).toBe(2_400_000)
  })

  it('el ingreso real del mes gana sobre el sueldo configurado', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [SUELDO],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.ingresosEstimados).toBe(false)
  })

  it('el sueldo configurado gana sobre el promedio histórico', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, ingresoMensual: 2_500_000 },
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-01' }),
      ],
    })
    expect(calcularMargen(ctx).ingresos).toBe(2_500_000)
  })

  it('estima los ingresos con el histórico cuando el mes aún no tiene nómina', () => {
    const ctx = contexto({
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_800_000, fecha: '2026-06-01' }),
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_200_000, fecha: '2026-07-01' }),
        transaccion({ monto: 100_000, fecha: '2026-08-02' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresosEstimados).toBe(true)
    expect(margen.ingresos).toBe(2_000_000)
    expect(margen.flujoDelCiclo).toBe(1_900_000)
  })
})

describe('calcularMargen con ciclo quincenal', () => {
  const QUINCENAL = { ...AJUSTES, cicloPago: 'quincenal' as const }

  it('solo cuenta los movimientos de la quincena en curso', () => {
    const ctx = contexto({
      ajustes: QUINCENAL,
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_000_000, fecha: '2026-08-01' }),
        transaccion({ monto: 200_000, fecha: '2026-08-05' }),
        // Fuera de la primera quincena: no debe contar el 13 de agosto.
        transaccion({ monto: 900_000, fecha: '2026-08-20' }),
      ],
      hoy: '2026-08-10',
    })
    const margen = calcularMargen(ctx)
    expect(margen.ciclo.inicio).toBe('2026-08-01')
    expect(margen.ciclo.fin).toBe('2026-08-15')
    expect(margen.ingresos).toBe(1_000_000)
    expect(margen.egresos).toBe(200_000)
  })

  it('reparte el sueldo configurado entre las dos quincenas', () => {
    const ctx = contexto({
      ajustes: { ...QUINCENAL, ingresoMensual: 2_000_000 },
      transacciones: [transaccion({ monto: 50_000, fecha: '2026-08-18' })],
      hoy: '2026-08-20',
    })
    const margen = calcularMargen(ctx)
    expect(margen.ingresos).toBe(1_000_000)
    expect(margen.ingresosEstimados).toBe(true)
  })

  it('reparte el aporte a metas entre las quincenas que quedan del mes', () => {
    const base = { ajustes: QUINCENAL, metas: [meta({ id: 'm1', aporteMensual: 400_000 })] }
    const primera = calcularMargen(contexto({ ...base, hoy: '2026-08-05' }))
    const segunda = calcularMargen(contexto({ ...base, hoy: '2026-08-20' }))
    expect(primera.compromisoMeta).toBe(200_000)
    expect(segunda.compromisoMeta).toBe(400_000)
  })

  it('el gasto diario se reparte entre los días que quedan de la quincena', () => {
    const ctx = contexto({
      ajustes: { ...QUINCENAL, ingresoMensual: 3_000_000 },
      hoy: '2026-08-11',
    })
    const margen = calcularMargen(ctx)
    // Del 11 al 15 son 5 días y la quincena aporta 1,500,000.
    expect(margen.diasRestantes).toBe(5)
    expect(margen.gastoDiarioSugerido).toBe(300_000)
  })

  it('un mes pasado se lee completo, no por quincenas', () => {
    const ctx = contexto({
      ajustes: QUINCENAL,
      periodo: '2026-07',
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-03' }),
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-07-20' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.ciclo.tipo).toBe('mensual')
    expect(margen.ingresos).toBe(1_800_000)
    expect(margen.diasRestantes).toBe(0)
  })
})

describe('ingresoTipico', () => {
  it('promedia solo los meses que tuvieron ingreso', () => {
    const historial = [
      transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 1_000_000, fecha: '2026-07-01' }),
      transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 2_000_000, fecha: '2026-06-01' }),
    ]
    expect(ingresoTipico(historial, '2026-08')).toBe(1_500_000)
  })

  it('es cero sin historial', () => {
    expect(ingresoTipico([], '2026-08')).toBe(0)
  })
})

describe('evaluarGasto', () => {
  it('da verde a un gasto que cabe en presupuesto y margen', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('verde')
    expect(veredicto.margenDespues).toBe(1_980_000)
  })

  it('pone en rojo el gasto que rebasa el presupuesto de su categoría', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 480_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(50_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'presupuesto-categoria')?.texto).toContain('Te pasas')
  })

  it('avisa en ámbar al acercarse al límite de la categoría', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 380_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(30_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('ambar')
  })

  it('pone en rojo lo que compromete un pago de deuda cercano', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [
        deuda({ acreedor: 'Nu', fechaLimite: '2026-08-16', pagoMinimo: 1_800_000, saldoActual: 2_500_000 }),
      ],
    })
    const veredicto = evaluarGasto(400_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('deuda')
  })

  it('avisa cuando el gasto se come el aporte a metas', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 1_500_000, categoriaId: 'renta' })],
      metas: [meta({ id: 'm1', aporteMensual: 400_000 })],
    })
    const veredicto = evaluarGasto(200_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('metas')
  })

  it('no juzga cuando no hay ingresos con qué medir', () => {
    const ctx = contexto({ transacciones: [transaccion({ monto: 50_000 })] })
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('ambar')
    expect(veredicto.razones.some((r) => r.clave === 'sin-ingresos')).toBe(true)
  })

  it('con monto cero lee el estado general del mes', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 600_000 })],
      presupuestos: [presupuesto({ montoLimite: 500_000 })],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('verde')
    expect(veredicto.margenAntes).toBe(1_400_000)
  })

  it('reporta números rojos en la lectura general cuando el mes ya se pasó', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 2_500_000, categoriaId: 'renta' })],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('números rojos')
  })

  it('en la lectura general habla en presente, no en condicional', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [
        deuda({ acreedor: 'Nu', fechaLimite: '2026-08-16', pagoMinimo: 2_400_000, saldoActual: 2_500_000 }),
      ],
    })
    const texto = evaluarGasto(0, null, ctx).razones.find((r) => r.clave === 'margen')?.texto ?? ''
    expect(texto).toContain('Te faltan')
    expect(texto).not.toContain('quedarías')
  })

  it('respeta el tope global del mes aunque la categoría no tenga presupuesto', () => {
    const ctx = contexto({
      transacciones: [SUELDO, transaccion({ monto: 900_000, categoriaId: 'renta' })],
      presupuestos: [presupuesto({ categoriaId: null, montoLimite: 1_000_000 })],
    })
    const veredicto = evaluarGasto(200_000, 'comida', ctx)
    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.razones.some((r) => r.clave === 'presupuesto-global')).toBe(true)
  })

  it('ignora presupuestos de otro periodo', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      presupuestos: [presupuesto({ montoLimite: 1_000, periodo: '2026-07' })],
    })
    expect(evaluarGasto(50_000, 'comida', ctx).nivel).toBe('verde')
  })

  it('menciona el vencimiento más cercano aunque el gasto quepa', () => {
    const ctx = contexto({
      transacciones: [SUELDO],
      deudas: [deuda({ acreedor: 'Nu', fechaLimite: '2026-08-15', pagoMinimo: 100_000 })],
    })
    const veredicto = evaluarGasto(10_000, 'comida', ctx)
    expect(veredicto.razones.find((r) => r.clave === 'vencimiento')?.texto).toContain('Nu')
  })
})

describe('el margen con saldo declarado', () => {
  it('separa el dinero acumulado del flujo del ciclo', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, saldoInicial: 850_000, saldoInicialFecha: '2026-08-01' },
      transacciones: [transaccion({ monto: 100_000, fecha: '2026-08-05' })],
      deudas: [deuda({ fechaLimite: '2026-08-16', pagoMinimo: 200_000, saldoActual: 900_000 })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.saldo.declarado).toBe(true)
    expect(margen.saldo.actual).toBe(750_000)
    expect(margen.dineroDisponible).toBe(750_000)
    // El colchón mira el dinero que existe: 750,000 − 200,000 de deuda.
    expect(margen.colchonTotal).toBe(550_000)
    // El margen del ciclo mira lo que entró y salió: no cayó nómina y salieron
    // 100,000, así que este ciclo va en negativo aunque haya ahorros.
    expect(margen.flujoDelCiclo).toBe(-100_000)
    expect(margen.margenLibre).toBe(-300_000)
  })

  it('sin saldo declarado sigue razonando con los flujos del periodo', () => {
    const ctx = contexto({
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 900_000, fecha: '2026-08-01' }),
        transaccion({ monto: 100_000, fecha: '2026-08-05' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.saldo.declarado).toBe(false)
    expect(margen.dineroDisponible).toBeNull()
    expect(margen.colchonTotal).toBeNull()
    expect(margen.flujoDelCiclo).toBe(800_000)
    expect(margen.margenLibre).toBe(800_000)
  })

  it('los abonos a deuda salen del saldo', () => {
    const base = {
      ajustes: { ...AJUSTES, saldoInicial: 500_000, saldoInicialFecha: '2026-08-01' },
    }
    const sinPago = calcularMargen(contexto(base))
    const conPago = calcularMargen(
      contexto({ ...base, pagos: [pago({ monto: 120_000, fecha: '2026-08-04' })] }),
    )
    expect(sinPago.saldo.actual - conPago.saldo.actual).toBe(120_000)
  })
})

describe('el gasto diario nunca reparte los ahorros', () => {
  /**
   * El bug que originó esta separación: con el saldo acumulado como base, la
   * app invitaba a repartir el ahorro de meses entre los días que quedan del
   * ciclo. Lo que se puede gastar al día sale de lo que entra, no de lo que se
   * juntó.
   */
  it('un ahorro grande no infla lo que se puede gastar hoy', () => {
    const ctx = contexto({
      hoy: '2026-08-29',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        saldoInicial: 4_000_000,
        saldoInicialFecha: '2026-08-16',
      },
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 850_000, fecha: '2026-08-16' }),
      ],
    })
    const margen = calcularMargen(ctx)
    expect(margen.dineroDisponible).toBe(4_850_000)
    expect(margen.flujoDelCiclo).toBe(850_000)
    // Quedan del 29 al 31: tres días. 850,000 / 3, nunca 4,850,000 / 3.
    expect(margen.diasRestantes).toBe(3)
    expect(margen.gastoDiarioSugerido).toBe(283_333)
  })

  it('con flujo negativo no sugiere gastar nada, aunque haya colchón', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, saldoInicial: 4_000_000, saldoInicialFecha: '2026-08-01' },
      transacciones: [transaccion({ monto: 50_000, fecha: '2026-08-05' })],
    })
    const margen = calcularMargen(ctx)
    expect(margen.margenLibre).toBeLessThan(0)
    expect(margen.colchonTotal).toBeGreaterThan(0)
    expect(margen.gastoDiarioSugerido).toBe(0)
  })

  it('cuando el saldo real es menor que el flujo del ciclo, el sugerido respeta el saldo', () => {
    // Caso típico al inicio de la quincena: el sueldo aún no cae pero la
    // cuenta trae poco. Antes sugería repartir el sueldo futuro entre los
    // días que faltan (optimista); ahora respeta lo que de verdad hay.
    const ctx = contexto({
      hoy: '2026-08-19',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_700_000,
        saldoInicial: 21_000,
        saldoInicialFecha: '2026-08-16',
      },
    })
    const margen = calcularMargen(ctx)
    // 1,700,000 / 2 quincenas = 850,000 estimados en este ciclo.
    expect(margen.flujoDelCiclo).toBe(850_000)
    // En la cuenta hoy hay 21, sin compromisos pendientes.
    expect(margen.colchonTotal).toBe(21_000)
    // El sugerido baja de 850k/12 a lo que el saldo permite repartir.
    expect(margen.gastoDiarioSugerido).toBeLessThan(850_000 / margen.diasRestantes)
    expect(margen.gastoDiarioSugerido).toBe(Math.floor(21_000 / margen.diasRestantes))
  })

  it('un periodo ya cerrado no divide entre cero', () => {
    const margen = calcularMargen(contexto({ periodo: '2026-07' }))
    expect(margen.diasRestantes).toBe(0)
    expect(margen.gastoDiarioSugerido).toBe(0)
  })
})

describe('el veredicto distingue quedarse corto de tirar del ahorro', () => {
  it('con colchón que cubre el bajón, avisa en ámbar en vez de rojo', () => {
    const ctx = contexto({
      ajustes: { ...AJUSTES, saldoInicial: 4_000_000, saldoInicialFecha: '2026-08-01' },
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 800_000, fecha: '2026-08-01' }),
        transaccion({ monto: 850_000, fecha: '2026-08-05' }),
      ],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('ambar')
    expect(veredicto.razones.find((r) => r.clave === 'margen')?.texto).toContain('ahorro')
  })

  it('sin colchón, el mismo bajón sí es rojo', () => {
    const ctx = contexto({
      transacciones: [
        transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 800_000, fecha: '2026-08-01' }),
        transaccion({ monto: 850_000, fecha: '2026-08-05' }),
      ],
    })
    const veredicto = evaluarGasto(0, null, ctx)
    expect(veredicto.nivel).toBe('rojo')
  })
})

describe('el simulador no miente cuando el saldo real es binding', () => {
  /**
   * Caso reportado: el usuario declaró $21 en su cuenta, la quincena aún no
   * cae y la app le decía "te quedan $6,300 libres después de un gasto de
   * $200". El flujo del ciclo (sueldo estimado / 2) leía 850k menos gastos
   * previos, pero su cuenta solo traía 21 pesos. La respuesta tiene que
   * cruzar el flujo con el colchón y reflejar el binding.
   */
  it('un gasto que cabe en el colchón pero rebasa el flujo se evalúa con el binding', () => {
    // Sin transacciones, así el flujo queda en 850k y el colchón en 21. Sin
    // compromiso de deuda, el binding es el mínimo(850k, 21) = 21.
    const ctx = contexto({
      hoy: '2026-08-19',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_700_000,
        saldoInicial: 21_000,
        saldoInicialFecha: '2026-08-16',
      },
    })
    const margen = calcularMargen(ctx)
    expect(margen.flujoDelCiclo).toBe(850_000)
    expect(margen.colchonTotal).toBe(21_000)

    // El flujo dice margen = 850k. La cuenta dice 21. El binding es 21.
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    // El binding - gasto = 21 - 20 = 1, sí alcanza.
    expect(veredicto.margenDespues).toBe(1_000)
    // La razón debe hablar de la cuenta, no del flujo.
    const textoMargen = veredicto.razones.find((r) => r.clave === 'margen')?.texto ?? ''
    expect(textoMargen).toContain('cuenta')
    expect(textoMargen).not.toContain('6,300')
  })

  it('un gasto que rebasa el colchón se marca en rojo aunque el flujo diga que sí alcanza', () => {
    const ctx = contexto({
      hoy: '2026-08-19',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_700_000,
        saldoInicial: 21_000,
        saldoInicialFecha: '2026-08-16',
      },
    })
    // 200 pesos de gasto con 21 en cuenta: el binding es 21, después = -179.
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.margenDespues).toBe(1_000)
    // Si gastara $40 con $21 en cuenta, binding - gasto = -19 → rojo.
    const rojo = evaluarGasto(40_000, 'comida', ctx)
    expect(rojo.margenDespues).toBe(-19_000)
    expect(rojo.nivel).toBe('rojo')
    const textoRojo = rojo.razones.find((r) => r.clave === 'margen')?.texto ?? ''
    expect(textoRojo).toContain('cuenta')
    expect(textoRojo).toContain('quincena')
  })

  it('sin saldo declarado, la simulación sigue hablando del flujo del ciclo', () => {
    // Si no declaró saldo, no hay binding y el comportamiento histórico
    // (basado en el flujo) se mantiene.
    const ctx = contexto({
      hoy: '2026-08-19',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_700_000,
      },
    })
    const veredicto = evaluarGasto(20_000, 'comida', ctx)
    expect(veredicto.margenDespues).toBe(830_000)
  })
})

describe('el disponible real manda en todas las superficies, no solo en el simulador', () => {
  /**
   * El caso que reportó el usuario, con sus números: declaró $27 en el banco,
   * la quincena todavía no cae y ya hay una deuda por vencer. El flujo del
   * ciclo (sueldo estimado) dice $6,500 libres; la cuenta dice otra cosa.
   *
   * El arreglo anterior cruzó flujo y colchón dentro de `evaluarGasto`, pero
   * dejó el cruce escondido ahí: el tablero, el desglose, el panel de dinero,
   * las recomendaciones y el PDF siguieron leyendo `margenLibre` a secas. Por
   * eso el tablero enseñaba "6,500 libres ÷ 12 días = 0 al día", una ecuación
   * que no cuadra. El binding tiene que salir del dominio, una sola vez.
   */
  function cuentaFlacaQuincenaSinCaer() {
    return contexto({
      hoy: '2026-08-20',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 1_900_000,
        saldoInicial: 2_700,
        saldoInicialFecha: '2026-08-16',
      },
      deudas: [deuda({ id: 'd1', pagoMinimo: 300_000, fechaLimite: '2026-08-25' })],
    })
  }

  it('margenDisponible es el mínimo entre el flujo del ciclo y el colchón real', () => {
    const margen = calcularMargen(cuentaFlacaQuincenaSinCaer())

    expect(margen.margenLibre).toBe(650_000)
    expect(margen.colchonTotal).toBe(-297_300)
    expect(margen.margenDisponible).toBe(-297_300)
    expect(margen.limitadoPorSaldo).toBe(true)
  })

  it('sin saldo declarado el disponible sigue siendo el flujo del ciclo', () => {
    const ctx = contexto({
      hoy: '2026-08-20',
      ajustes: { ...AJUSTES, cicloPago: 'quincenal', ingresoMensual: 1_900_000 },
      deudas: [deuda({ id: 'd1', pagoMinimo: 300_000, fechaLimite: '2026-08-25' })],
    })
    const margen = calcularMargen(ctx)

    expect(margen.margenDisponible).toBe(margen.margenLibre)
    expect(margen.limitadoPorSaldo).toBe(false)
  })

  it('el gasto diario sugerido es el disponible dividido entre los días que faltan', () => {
    // La ecuación que el tablero enseña tiene que cuadrar con la que calcula.
    const margen = calcularMargen(cuentaFlacaQuincenaSinCaer())

    expect(margen.gastoDiarioSugerido).toBe(
      Math.max(0, Math.floor(margen.margenDisponible / margen.diasRestantes)),
    )
  })

  it('el veredicto informa antes y después de la misma magnitud', () => {
    const ctx = cuentaFlacaQuincenaSinCaer()
    const veredicto = evaluarGasto(20_000, null, ctx)

    expect(veredicto.margenAntes).toBe(calcularMargen(ctx).margenDisponible)
    expect(veredicto.margenDespues).toBe(veredicto.margenAntes - 20_000)
  })

  it('gastar casi todo lo que hay en la cuenta avisa aunque el flujo sea enorme', () => {
    // $1,000 en la cuenta y una quincena estimada de $10,000 que aún no cae.
    // Gastar $900 deja la cuenta en $100: cabe, pero es el 90% de lo que hay.
    const ctx = contexto({
      hoy: '2026-08-20',
      ajustes: {
        ...AJUSTES,
        cicloPago: 'quincenal',
        ingresoMensual: 2_000_000,
        saldoInicial: 100_000,
        saldoInicialFecha: '2026-08-16',
      },
    })
    const veredicto = evaluarGasto(90_000, null, ctx)

    expect(veredicto.margenDespues).toBe(10_000)
    expect(veredicto.nivel).toBe('ambar')
  })
})

describe('decir "todavía no cobro" cambia las cuentas, no solo esconde la tarjeta', () => {
  /**
   * La tarjeta "¿Ya cobraste?" ofrece dos respuestas y solo una servía: al
   * decir que sí, el ingreso se registraba; al decir "todavía no", la tarjeta
   * se ocultaba y el margen seguía repartiendo un sueldo que la persona
   * acababa de decir que no tiene. La respuesta es un dato, no un descarte.
   */
  const SIN_COBRAR = {
    hoy: '2026-08-20',
    ajustes: { ...AJUSTES, cicloPago: 'quincenal' as const, ingresoMensual: 1_900_000 },
  }

  it('el estimado sigue siendo proyección pero deja de ser gastable', () => {
    const margen = calcularMargen(contexto({ ...SIN_COBRAR, cicloSinCobrar: '2026-08-16' }))

    // La proyección se conserva: es lo que tendrá cuando caiga la quincena.
    expect(margen.margenLibre).toBe(950_000)
    // Lo gastable hoy no incluye dinero que ella misma dijo que no ha llegado.
    expect(margen.margenDisponible).toBe(0)
    expect(margen.cobroPendiente).toBe(true)
  })

  it('la respuesta solo vale para el ciclo en que se dio', () => {
    const margen = calcularMargen(contexto({ ...SIN_COBRAR, cicloSinCobrar: '2026-08-01' }))

    expect(margen.cobroPendiente).toBe(false)
    expect(margen.margenDisponible).toBe(950_000)
  })

  it('registrar el cobro deja sin efecto la respuesta anterior', () => {
    const margen = calcularMargen(
      contexto({
        ...SIN_COBRAR,
        cicloSinCobrar: '2026-08-16',
        transacciones: [
          transaccion({ tipo: 'ingreso', categoriaId: 'sueldo', monto: 950_000, fecha: '2026-08-16' }),
        ],
      }),
    )

    expect(margen.cobroPendiente).toBe(false)
    expect(margen.margenDisponible).toBe(950_000)
  })

  it('con saldo declarado manda la cuenta, que ya sabe que el cobro no cayó', () => {
    // Tiene $27 en el banco y dijo que todavía no cobra. Puede gastar esos
    // $27: son suyos y están ahí. Decirle que tiene cero también sería falso.
    const margen = calcularMargen(
      contexto({
        ...SIN_COBRAR,
        ajustes: { ...SIN_COBRAR.ajustes, saldoInicial: 2_700, saldoInicialFecha: '2026-08-16' },
        cicloSinCobrar: '2026-08-16',
      }),
    )

    expect(margen.cobroPendiente).toBe(true)
    expect(margen.margenDisponible).toBe(2_700)
  })

  it('no autoriza un gasto contra un sueldo que la persona dijo que no ha caído', () => {
    const ctx = contexto({ ...SIN_COBRAR, cicloSinCobrar: '2026-08-16' })
    const veredicto = evaluarGasto(20_000, null, ctx)

    expect(veredicto.nivel).toBe('rojo')
    expect(veredicto.margenDespues).toBe(-20_000)
  })
})
