import { ICONOS } from '@/datos/categoriasIniciales'
import { PALETA_CATEGORIAS } from '@/graficas/paleta'
import { clases } from './Basicos'
import { Icono } from './Icono'

/**
 * Rejilla de iconos. Se elige viendo el dibujo, no leyendo su nombre en una
 * lista desplegable: nadie sabe qué es "ChartNoAxesColumnIncreasing".
 */
export function SelectorIcono({
  valor,
  onCambio,
  color = 'var(--color-acento)',
  etiqueta = 'Icono',
}: {
  valor: string
  onCambio: (icono: string) => void
  color?: string
  etiqueta?: string
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-suave">{etiqueta}</span>
      <div
        className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto rounded-campo border border-borde bg-superficie p-2 sm:grid-cols-8"
        role="radiogroup"
        aria-label={etiqueta}
      >
        {ICONOS.map((opcion) => {
          const activo = opcion === valor
          return (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={activo}
              aria-label={opcion}
              onClick={() => onCambio(opcion)}
              className={clases(
                'flex aspect-square items-center justify-center rounded-lg transition-colors',
                activo ? 'bg-acento-suave' : 'hover:bg-elevada',
              )}
            >
              <Icono
                nombre={opcion}
                className="size-[18px]"
                style={{ color: activo ? color : 'var(--color-tenue)' }}
                strokeWidth={1.75}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SelectorColor({
  valor,
  onCambio,
  etiqueta = 'Color',
}: {
  valor: string
  onCambio: (color: string) => void
  etiqueta?: string
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-suave">{etiqueta}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={etiqueta}>
        {PALETA_CATEGORIAS.map((opcion) => (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={valor === opcion}
            aria-label={`Color ${opcion}`}
            onClick={() => onCambio(opcion)}
            className={clases(
              'size-8 rounded-full transition-transform',
              valor === opcion
                ? 'ring-2 ring-tinta ring-offset-2 ring-offset-superficie'
                : 'hover:scale-110',
            )}
            style={{ backgroundColor: opcion }}
          />
        ))}
      </div>
    </div>
  )
}
