import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { clases } from './Basicos'

/**
 * Control segmentado con indicador que se desliza.
 *
 * Tema, acento y ciclo de cobro eran tres grupos de botones escritos por
 * separado donde la selección saltaba de golpe. Aquí la pastilla viaja entre
 * opciones con el mismo resorte de la barra inferior, así que toda la app
 * responde igual al dedo.
 *
 * El `layoutId` necesita ser único por instancia: dos segmentados con el mismo
 * identificador harían que sus pastillas se animen entre sí a través de la
 * pantalla.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambiar,
  etiqueta,
  columnas,
}: {
  opciones: readonly { valor: T; etiqueta: string }[]
  valor: T
  onCambiar: (valor: T) => void
  etiqueta: string
  /** Por omisión reparte en tantas columnas como opciones haya. */
  columnas?: number
}) {
  const id = useId()
  const reducido = useReducedMotion()
  const total = columnas ?? opciones.length

  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="grid gap-1 rounded-full bg-elevada p-1"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {opciones.map((opcion) => {
        const activa = valor === opcion.valor
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambiar(opcion.valor)}
            className={clases(
              'relative min-h-9 rounded-full py-2 text-[15px] font-medium transition-colors',
              activa ? 'text-tinta' : 'text-suave hover:text-tinta',
            )}
          >
            {activa && (
              // Sin z negativo: el contenedor tiene fondo propio y un -z-10
              // mandaría la pastilla detrás de él, invisible. El contenido se
              // eleva por encima con su propio z.
              <motion.span
                layoutId={`segmentado-${id}`}
                className="absolute inset-0 rounded-full bg-superficie shadow-sm"
                transition={
                  reducido ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }
                }
              />
            )}
            <motion.span
              className="relative z-10 block truncate px-1"
              whileTap={reducido ? undefined : { scale: 0.95 }}
              transition={
                reducido ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }
              }
            >
              {opcion.etiqueta}
            </motion.span>
          </button>
        )
      })}
    </div>
  )
}
