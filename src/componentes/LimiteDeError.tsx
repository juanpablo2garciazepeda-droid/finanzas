import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Red de seguridad para errores de render.
 *
 * Sin esto, cualquier excepción durante el render desmonta el árbol entero y
 * deja la pantalla en negro, sin un solo indicio de qué pasó: exactamente lo
 * que ocurría cuando el login llamaba a `useAvisos` fuera de su proveedor.
 * Una pantalla negra no se puede reportar; un mensaje con el error sí.
 *
 * React no ofrece equivalente en hooks: los límites de error siguen siendo
 * clases, y por eso este es el único componente de clase del proyecto.
 */

interface Props {
  children: ReactNode
  /** Etiqueta de la zona que envuelve, para saber dónde reventó. */
  zona?: string
}

interface Estado {
  error: Error | null
}

export class LimiteDeError extends Component<Props, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola del navegador para poder diagnosticarlo con el
    // stack de componentes, que el mensaje visible no incluye.
    console.error(`[${this.props.zona ?? 'app'}]`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-fondo px-6 py-10 text-center">
        <div className="w-full max-w-md rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h1 className="font-display text-[22px] font-semibold text-tinta">
            Algo se rompió
          </h1>
          <p className="mt-2 text-[15px] text-suave">
            La aplicación encontró un error inesperado y no pudo seguir. Recargar suele
            bastar; si vuelve a pasar, avísanos con el detalle de abajo.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-campo bg-elevada p-3 text-left text-[12px] leading-relaxed break-words whitespace-pre-wrap text-suave">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full bg-acento px-5 py-[11px] text-[15px] text-sobre-acento transition-colors hover:bg-acento-hondo"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/'
                window.location.reload()
              }}
              className="inline-flex items-center justify-center rounded-full border border-borde bg-elevada px-5 py-[11px] text-[15px] text-acento transition-colors hover:bg-hundida"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
