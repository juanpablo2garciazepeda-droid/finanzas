import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { clases } from './Basicos'

/**
 * Hoja inferior en móvil, diálogo centrado en escritorio. Registrar un gasto
 * pasa por aquí, así que el contenido tiene que quedar al alcance del pulgar.
 *
 * Entrada y salida animadas con motion: el panel sube y se escala al abrir,
 * y al cerrar hace el camino inverso. El backdrop también aparece y
 * desaparece con fade. `AnimatePresence` se encarga de que la salida se
 * reproduzca antes de desmontar: si lo desmontáramos al cerrar, el panel
 * saltaría en vez de deslizarse.
 *
 * Quien tenga `prefers-reduced-motion` ve el modal sin animar: la duración
 * se reduce a casi 0 y los springs se vuelven tweens lineales.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  ancho = 'sm:max-w-lg',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
  ancho?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  // El efecto de abajo solo debe correr al abrir y cerrar el modal, no cada
  // vez que `onCerrar` cambia de identidad (algo tan común como escribir en
  // un campo del formulario, si ese formulario vive en el mismo componente
  // que crea el `onCerrar` en línea). Si dependiera de `onCerrar`, cada
  // tecleo reiniciaría el bloqueo de scroll y volvería a enfocar el primer
  // control del modal, robándole el foco a lo que se esté escribiendo.
  const onCerrarRef = useRef(onCerrar)
  onCerrarRef.current = onCerrar
  const reducido = useReducedMotion()

  useEffect(() => {
    if (!abierto) return

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrarRef.current()
    }
    document.addEventListener('keydown', alPresionar)

    // `overflow: hidden` en el body no basta en iOS Safari: el fondo igual
    // se arrastra con el dedo (rubber-banding) aunque no haya scrollbar.
    // Fijar el body en su posición actual sí lo bloquea en todos lados; al
    // cerrar se restaura el scroll exacto de antes, sin saltos.
    const scrollY = window.scrollY
    const cuerpo = document.body.style
    const previo = { position: cuerpo.position, top: cuerpo.top, left: cuerpo.left, right: cuerpo.right }
    cuerpo.position = 'fixed'
    cuerpo.top = `-${scrollY}px`
    cuerpo.left = '0'
    cuerpo.right = '0'

    // El primer campo enfocado ahorra un toque en el flujo más frecuente.
    const primero = panel.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button',
    )
    primero?.focus()

    return () => {
      document.removeEventListener('keydown', alPresionar)
      cuerpo.position = previo.position
      cuerpo.top = previo.top
      cuerpo.left = previo.left
      cuerpo.right = previo.right
      window.scrollTo(0, scrollY)
    }
  }, [abierto])

  // Curvas distintas según si la máquina del usuario prefiere menos
  // movimiento. El spring normal es el que da la sensación física; el lineal
  // es el plan B accesible.
  const springEntrada = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 }
  const tweenReducida = { duration: 0.08, ease: 'linear' as const }
  const transPanel = reducido ? tweenReducida : springEntrada
  // El backdrop entra y sale más rápido que el panel: cuando aparece, oscurece
  // antes de que el panel se asiente; cuando desaparece, lo hace casi al
  // mismo tiempo que el panel termina de deslizarse.
  const transBackdrop = { duration: reducido ? 0.06 : 0.22, ease: 'easeOut' as const }

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transBackdrop}
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            initial={{ opacity: 0, y: reducido ? 0 : 24, scale: reducido ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reducido ? 0 : 12, scale: reducido ? 1 : 0.98 }}
            transition={transPanel}
            className={clases(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
              'rounded-t-[20px] bg-superficie shadow-flotante sm:rounded-[20px]',
              ancho,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-borde px-5 py-4">
              <div>
                <h2 className="font-display text-[21px] font-semibold text-tinta">{titulo}</h2>
                {descripcion && <p className="mt-0.5 text-sm text-suave">{descripcion}</p>}
              </div>
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="-mt-1 -mr-1 rounded-full p-1.5 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>
            <div className="area-segura-inferior flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Confirmación para acciones que borran datos. */
export function ConfirmarBorrado({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  mensaje,
  textoBoton = 'Eliminar',
}: {
  abierto: boolean
  onCerrar: () => void
  onConfirmar: () => void
  titulo: string
  mensaje: string
  textoBoton?: string
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="sm:max-w-sm">
      <p className="text-sm text-suave">{mensaje}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCerrar}
          className="flex-1 rounded-xl border border-borde bg-elevada px-4 py-2.5 text-sm font-medium text-tinta transition-colors hover:border-borde-fuerte"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirmar()
            onCerrar()
          }}
          className="flex-1 rounded-xl border border-rojo/30 bg-rojo/15 px-4 py-2.5 text-sm font-medium text-rojo transition-colors hover:bg-rojo/25"
        >
          {textoBoton}
        </button>
      </div>
    </Modal>
  )
}
