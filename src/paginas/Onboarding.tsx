import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, Sparkles, Wallet } from 'lucide-react'
import { Boton, Tarjeta, clases } from '@/componentes/ui/Basicos'

const CLAVE_ONBOARDING = 'finanzas.onboarding.visto'

interface Paso {
  titulo: string
  detalle: string
  icono: React.ReactNode
  cta?: { etiqueta: string; ruta: string }
}

const PASOS: Paso[] = [
  {
    titulo: 'Bienvenido a Finanzas GZ',
    detalle:
      'Esta app te dice cuánto puedes gastar HOY sin romper nada, considerando tus deudas, tus metas y tu próximo cobro.',
    icono: <Sparkles className="size-6 text-acento" aria-hidden />,
  },
  {
    titulo: '1. Cuéntame tu ingreso y cuándo cobras',
    detalle:
      'En Ajustes → Tu ingreso, pon tu sueldo y cada cuánto cobras. Así calculo tu margen desde el día 1.',
    icono: <Wallet className="size-6 text-acento" aria-hidden />,
    cta: { etiqueta: 'Ir a Ajustes', ruta: '/ajustes' },
  },
  {
    titulo: '2. Registra tu primer gasto',
    detalle:
      'Toca el botón + de abajo. Monto, categoría y listo. Cada gasto se descuenta de tu margen.',
    icono: <Check className="size-6 text-acento" aria-hidden />,
  },
  {
    titulo: '3. Carga tus deudas y metas',
    detalle:
      'Sin esto, el tablero no sabe cuánto tienes comprometido. Cada deuda y cada meta aparta dinero antes de darte luz verde.',
    icono: <ArrowRight className="size-6 text-acento" aria-hidden />,
  },
  {
    titulo: 'Listo, ya sabes lo básico',
    detalle:
      'El tablero se actualiza con cada movimiento. Si quieres que algo se repita solo (Netflix, renta, sueldo), crea un recurrente en Ajustes.',
    icono: <Check className="size-6 text-verde" aria-hidden />,
  },
]

/**
 * Onboarding que se muestra la primera vez que el usuario entra a la app.
 * Se persiste en localStorage que ya lo vio. Si quiere volver a verlo,
 * puede borrar la clave en la consola del navegador.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const [indice, setIndice] = useState(0)
  const paso = PASOS[indice]
  const esUltimo = indice === PASOS.length - 1
  const esPrimero = indice === 0

  function terminar() {
    localStorage.setItem(CLAVE_ONBOARDING, '1')
    navigate('/')
  }

  // Sin `min-h-dvh`: esta pantalla se dibuja DENTRO de `Disposicion`, que ya
  // aporta encabezado, barra inferior y su propio alto. Pedir la altura de la
  // ventana otra vez empujaba la tarjeta al centro de una zona que empieza
  // debajo del encabezado, y dejaba media pantalla en blanco arriba.
  return (
    <div className="mx-auto w-full max-w-md py-4">
      <Tarjeta className="w-full">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-acento-suave">
            {paso.icono}
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-tenue">
              Paso {indice + 1} de {PASOS.length}
            </p>
            <h1 className="font-display text-[20px] font-semibold text-tinta">{paso.titulo}</h1>
          </div>
        </div>

        <p className="text-[15px] text-suave">{paso.detalle}</p>

        {paso.cta && (
          <div className="mt-4">
            <Boton
              variante="secundario"
              onClick={() => {
                // NO marcamos como visto: el usuario va a hacer lo que el
                // paso le pide y va a volver. Si lo marcamos aquí, al
                // regresar a / ya no aparece la sugerencia y se queda sin
                // contexto. Solo `terminar` (botón "Empezar" del último
                // paso) debe sellar el onboarding.
                navigate(paso.cta!.ruta)
              }}
            >
              {paso.cta.etiqueta}
              <ArrowRight className="size-4" aria-hidden />
            </Boton>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIndice(Math.max(0, indice - 1))}
            disabled={esPrimero}
            className={clases(
              'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-suave',
              esPrimero ? 'cursor-default opacity-30' : 'hover:bg-elevada hover:text-tinta',
            )}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Atrás
          </button>
          <div className="flex items-center gap-1.5">
            {PASOS.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={clases(
                  'size-1.5 rounded-full',
                  i === indice ? 'bg-acento' : 'bg-borde',
                )}
              />
            ))}
          </div>
          {esUltimo ? (
            <Boton onClick={terminar} className="px-4 py-2 text-[14px]">
              Empezar
            </Boton>
          ) : (
            <Boton
              onClick={() => setIndice(indice + 1)}
              className="px-4 py-2 text-[14px]"
            >
              Siguiente
              <ArrowRight className="size-4" aria-hidden />
            </Boton>
          )}
        </div>
      </Tarjeta>
    </div>
  )
}

export function debeMostrarOnboarding(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CLAVE_ONBOARDING) !== '1'
}
