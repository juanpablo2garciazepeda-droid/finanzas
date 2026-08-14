import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { clases } from './Basicos'

/**
 * Hoja inferior en móvil, diálogo centrado en escritorio. Registrar un gasto
 * pasa por aquí, así que el contenido tiene que quedar al alcance del pulgar.
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

  // Desmontar al cerrar es lo que garantiza que el contenido arranque limpio:
  // un formulario que sobrevive escondido conserva lo que se escribió la vez
  // anterior y lo muestra al volver a abrirlo.
  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={clases(
          'animar-entrada relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
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
      </div>
    </div>
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
