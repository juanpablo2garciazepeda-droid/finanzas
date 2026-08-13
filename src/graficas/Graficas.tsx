import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatearCompacto, formatearMoneda, sumar } from '@/dominio/dinero'
import { nombrePeriodo, periodoCorto } from '@/dominio/fechas'
import { useFormato } from '@/estado/finanzas'
import { useEsOscuro } from '@/estado/tema'
import { COLOR, cromoDe } from './paleta'

interface Formato {
  moneda: string
  locale: string
}

/** Tooltip común: fondo opaco, cifras tabulares, un renglón por serie. */
function CuadroDatos({
  titulo,
  filas,
  formato,
}: {
  titulo: string
  filas: { nombre: string; valor: number; color: string }[]
  formato: Formato
}) {
  return (
    <div className="rounded-xl border border-borde bg-elevada px-3 py-2 shadow-lg shadow-black/50">
      <p className="mb-1.5 text-xs font-medium text-suave capitalize">{titulo}</p>
      <ul className="space-y-1">
        {filas.map((fila) => (
          <li key={fila.nombre} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: fila.color }} />
            <span className="text-tenue">{fila.nombre}</span>
            <span className="cifras ml-auto font-medium text-tinta">
              {formatearMoneda(fila.valor, formato.moneda, formato.locale, { conDecimales: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {series.map((serie) => (
        <li key={serie.nombre} className="flex items-center gap-1.5 text-xs text-suave">
          <span className="size-2 rounded-full" style={{ backgroundColor: serie.color }} />
          {serie.nombre}
        </li>
      ))}
    </ul>
  )
}

/**
 * Los ejes se recalculan por tema: un gris de modo claro desaparece en negro.
 * Lleva prefijo `use` en inglés porque la regla de hooks de React lo exige.
 */
function useCromo() {
  const esOscuro = useEsOscuro()
  const cromo = cromoDe(esOscuro)
  return {
    esOscuro,
    cromo,
    ejeComun: { tickLine: false, axisLine: false, tick: { fill: cromo.eje, fontSize: 11 } } as const,
  }
}

// ─── Ingresos contra egresos ─────────────────────────────────────────────────

export function GraficaFlujo({
  datos,
}: {
  datos: { periodo: string; ingresos: number; egresos: number }[]
}) {
  const formato = useFormato()
  const { esOscuro, cromo, ejeComun } = useCromo()
  const series = [
    { nombre: 'Ingresos', color: COLOR.ingresos },
    { nombre: 'Egresos', color: COLOR.egresos },
  ]

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={datos} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={cromo.rejilla} />
          <XAxis dataKey="periodo" tickFormatter={periodoCorto} {...ejeComun} />
          <YAxis
            tickFormatter={(v: number) => formatearCompacto(v, formato.moneda, formato.locale)}
            width={58}
            {...ejeComun}
          />
          <Tooltip
            cursor={{ fill: esOscuro ? '#ffffff10' : '#00000008' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CuadroDatos
                  titulo={nombrePeriodo(String(label))}
                  formato={formato}
                  filas={[
                    { nombre: 'Ingresos', valor: Number(payload[0]?.value ?? 0), color: COLOR.ingresos },
                    { nombre: 'Egresos', valor: Number(payload[1]?.value ?? 0), color: COLOR.egresos },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="ingresos" fill={COLOR.ingresos} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="egresos" fill={COLOR.egresos} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <Leyenda series={series} />
    </div>
  )
}

// ─── Distribución del gasto ──────────────────────────────────────────────────

export interface RebanadaCategoria {
  nombre: string
  valor: number
  color: string
}

/** Más de siete rebanadas no se leen: el resto se agrupa en "Otras". */
export function GraficaCategorias({ datos }: { datos: RebanadaCategoria[] }) {
  const formato = useFormato()
  const { cromo } = useCromo()

  const { rebanadas, total } = useMemo(() => {
    const ordenadas = [...datos].sort((a, b) => b.valor - a.valor)
    const visibles = ordenadas.slice(0, 6)
    const resto = ordenadas.slice(6)
    if (resto.length > 0) {
      visibles.push({ nombre: 'Otras', valor: sumar(resto.map((r) => r.valor)), color: '#86868B' })
    }
    return { rebanadas: visibles, total: sumar(ordenadas.map((r) => r.valor)) }
  }, [datos])

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-tenue">Sin gastos registrados en este mes.</p>
  }

  return (
    <div className="sm:flex sm:items-center sm:gap-6">
      <div className="relative mx-auto w-full max-w-56 shrink-0">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={rebanadas}
              dataKey="valor"
              nameKey="nombre"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {rebanadas.map((rebanada) => (
                <Cell key={rebanada.nombre} fill={rebanada.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <CuadroDatos
                    titulo={String(payload[0]?.name ?? '')}
                    formato={formato}
                    filas={[
                      {
                        nombre: 'Gastado',
                        valor: Number(payload[0]?.value ?? 0),
                        color: String(payload[0]?.payload?.color ?? cromo.eje),
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] tracking-wide text-tenue uppercase">Total</p>
          <p className="cifras text-lg font-semibold text-tinta">
            {formatearCompacto(total, formato.moneda, formato.locale)}
          </p>
        </div>
      </div>

      {/* La lista es a la vez leyenda y tabla: identidad nunca por color solo. */}
      <ul className="mt-4 flex-1 space-y-2 sm:mt-0">
        {rebanadas.map((rebanada) => (
          <li key={rebanada.nombre} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: rebanada.color }} />
            <span className="truncate text-suave">{rebanada.nombre}</span>
            <span className="ml-auto shrink-0 text-xs text-tenue">
              {Math.round((rebanada.valor / total) * 100)}%
            </span>
            <span className="cifras w-24 shrink-0 text-right font-medium text-tinta">
              {formatearMoneda(rebanada.valor, formato.moneda, formato.locale, { conDecimales: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Deuda y ahorro en el tiempo ─────────────────────────────────────────────

export function GraficaEvolucion({
  datos,
}: {
  datos: { periodo: string; deuda: number; ahorro: number }[]
}) {
  const formato = useFormato()
  const { cromo, ejeComun } = useCromo()
  const series = [
    { nombre: 'Deuda', color: COLOR.deuda },
    { nombre: 'Ahorro', color: COLOR.ahorro },
  ]

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={datos} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={cromo.rejilla} />
          <XAxis dataKey="periodo" tickFormatter={periodoCorto} {...ejeComun} />
          <YAxis
            tickFormatter={(v: number) => formatearCompacto(v, formato.moneda, formato.locale)}
            width={58}
            {...ejeComun}
          />
          <Tooltip
            cursor={{ stroke: cromo.rejilla, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <CuadroDatos
                  titulo={nombrePeriodo(String(label))}
                  formato={formato}
                  filas={[
                    { nombre: 'Deuda', valor: Number(payload[0]?.value ?? 0), color: COLOR.deuda },
                    { nombre: 'Ahorro', valor: Number(payload[1]?.value ?? 0), color: COLOR.ahorro },
                  ]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="deuda"
            stroke={COLOR.deuda}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR.deuda, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: cromo.superficie, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ahorro"
            stroke={COLOR.ahorro}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR.ahorro, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: cromo.superficie, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <Leyenda series={series} />
    </div>
  )
}
