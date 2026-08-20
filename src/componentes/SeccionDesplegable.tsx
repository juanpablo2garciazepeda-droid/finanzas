import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

/**
 * Sección colapsable estilo iOS: un header tappeable con icono + título +
 * chevron rotatorio. Al expandir muestra el contenido con animación de
 * altura. Ideal para reducir peso visual en páginas con muchas secciones
 * (como Ajustes).
 *
 * @example
 *   <SeccionDesplegable icono={Palette} titulo="Apariencia" subtitulo="Tema y moneda">
 *     <Tarjeta>…</Tarjeta>
 *   </SeccionDesplegable>
 */
export function SeccionDesplegable({
  icono: Icono,
  titulo,
  subtitulo,
  children,
  inicialAbierto = false,
}: {
  icono: LucideIcon
  titulo: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  inicialAbierto?: boolean
}) {
  const [abierto, setAbierto] = useState(inicialAbierto)
  const reducir = useReducedMotion()

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 text-left shadow-tarjeta transition-colors hover:bg-elevada sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-acento/10 text-acento">
            <Icono className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-tinta">{titulo}</p>
            {subtitulo && (
              <p className="mt-0.5 text-[13px] text-tenue">{subtitulo}</p>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex shrink-0 text-suave"
        >
          <ChevronDown className="size-5" aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={reducir ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
