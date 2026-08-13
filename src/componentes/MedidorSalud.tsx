import type { Salud } from '@/dominio/salud'
import { clases } from './ui/Basicos'

/**
 * Velocímetro de salud financiera.
 *
 * El arco se pinta por tramos con los colores del semáforo, así que la posición
 * de la aguja dice el estado sin necesidad de leer el número: rojo abajo,
 * ámbar en medio, verde arriba. El mismo lenguaje que usa el resto de la app
 * para responder "¿puedo gastar?".
 */

const TRAMOS = [
  { hasta: 40, color: 'var(--color-rojo)', etiqueta: 'Frágil' },
  { hasta: 70, color: 'var(--color-ambar)', etiqueta: 'Ajustada' },
  { hasta: 100, color: 'var(--color-verde)', etiqueta: 'Sana' },
]

/** Semicírculo de 180°: 0 puntos a la izquierda, 100 a la derecha. */
const RADIO = 78
const CENTRO = { x: 100, y: 100 }

function punto(fraccion: number, radio: number) {
  const angulo = Math.PI * (1 - Math.min(1, Math.max(0, fraccion)))
  return {
    x: CENTRO.x + radio * Math.cos(angulo),
    y: CENTRO.y - radio * Math.sin(angulo),
  }
}

function arco(desde: number, hasta: number, radio: number): string {
  const a = punto(desde, radio)
  const b = punto(hasta, radio)
  return `M ${a.x} ${a.y} A ${radio} ${radio} 0 0 1 ${b.x} ${b.y}`
}

export function MedidorSalud({ salud }: { salud: Salud }) {
  const fraccion = salud.suficiente ? salud.puntaje / 100 : 0
  const aguja = punto(fraccion, RADIO - 20)
  const base = punto(fraccion, 8)

  const tono = !salud.suficiente
    ? 'text-tenue'
    : salud.puntaje >= 70
      ? 'text-verde'
      : salud.puntaje >= 40
        ? 'text-ambar'
        : 'text-rojo'

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 120"
        className="w-64 max-w-full"
        role="img"
        aria-label={
          salud.suficiente
            ? `Salud financiera: ${salud.puntaje} de 100, ${salud.etiqueta}`
            : 'Salud financiera sin datos suficientes'
        }
      >
        {/* Tramos de color: la escala completa siempre visible. */}
        {TRAMOS.map((tramo, i) => {
          const desde = i === 0 ? 0 : TRAMOS[i - 1].hasta / 100
          return (
            <path
              key={tramo.etiqueta}
              d={arco(desde, tramo.hasta / 100, RADIO)}
              fill="none"
              stroke={tramo.color}
              strokeWidth="14"
              strokeLinecap="butt"
              opacity={salud.suficiente ? 1 : 0.25}
            />
          )
        })}

        {salud.suficiente && (
          <>
            <line
              x1={base.x}
              y1={base.y}
              x2={aguja.x}
              y2={aguja.y}
              stroke="var(--color-tinta)"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
            <circle cx={CENTRO.x} cy={CENTRO.y} r="7" fill="var(--color-tinta)" />
            <circle cx={CENTRO.x} cy={CENTRO.y} r="3" fill="var(--color-superficie)" />
          </>
        )}

        <text x="18" y="118" className="fill-tenue text-[10px]" textAnchor="middle">
          0
        </text>
        <text x="182" y="118" className="fill-tenue text-[10px]" textAnchor="middle">
          100
        </text>
      </svg>

      <p className={clases('cifras -mt-2 text-4xl font-semibold', tono)}>
        {salud.suficiente ? salud.puntaje : '—'}
      </p>
      <p className={clases('font-display text-[17px] font-semibold', tono)}>{salud.etiqueta}</p>
    </div>
  )
}
