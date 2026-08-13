import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { Check, CircleAlert, Info, X } from 'lucide-react'

type TipoAviso = 'exito' | 'error' | 'info'

interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
  deshacer?: () => void
}

interface ApiAvisos {
  mostrar: (texto: string, tipo?: TipoAviso, deshacer?: () => void) => void
}

const Contexto = createContext<ApiAvisos | null>(null)

const DURACION = 4200

const ESTILOS: Record<TipoAviso, { color: string; Icono: typeof Check }> = {
  exito: { color: 'text-verde', Icono: Check },
  error: { color: 'text-rojo', Icono: CircleAlert },
  info: { color: 'text-acento', Icono: Info },
}

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const cerrar = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((a) => a.id !== id))
  }, [])

  const mostrar = useCallback(
    (texto: string, tipo: TipoAviso = 'exito', deshacer?: () => void) => {
      const id = Date.now() + Math.random()
      setAvisos((previos) => [...previos.slice(-2), { id, texto, tipo, deshacer }])
      setTimeout(() => cerrar(id), DURACION)
    },
    [cerrar],
  )

  const api = useMemo(() => ({ mostrar }), [mostrar])

  return (
    <Contexto value={api}>
      {children}
      {/* Los avisos van por encima del botón flotante de registro: nunca deben
          tapar la acción principal de la app. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-44 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {avisos.map((aviso) => {
          const { color, Icono } = ESTILOS[aviso.tipo]
          return (
            <div
              key={aviso.id}
              className="animar-entrada pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full bg-superficie px-4 py-3 shadow-flotante"
            >
              <Icono className={`size-4 shrink-0 ${color}`} aria-hidden />
              <p className="flex-1 text-sm text-tinta">{aviso.texto}</p>
              {aviso.deshacer && (
                <button
                  type="button"
                  onClick={() => {
                    aviso.deshacer?.()
                    cerrar(aviso.id)
                  }}
                  className="text-sm font-medium text-acento hover:underline"
                >
                  Deshacer
                </button>
              )}
              <button
                type="button"
                onClick={() => cerrar(aviso.id)}
                aria-label="Cerrar aviso"
                className="text-tenue transition-colors hover:text-tinta"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </Contexto>
  )
}

export function useAvisos(): ApiAvisos {
  const valor = use(Contexto)
  if (!valor) throw new Error('useAvisos necesita estar dentro de ProveedorAvisos')
  return valor
}
