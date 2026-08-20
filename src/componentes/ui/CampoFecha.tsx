import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { aFechaLocal, diasDelPeriodo, hoyISO, nombrePeriodo, periodoDe, sumarMeses } from '@/dominio/fechas'
import { useT } from '@/estado/i18n'
import { clases } from './Basicos'

/**
 * Selector de fecha propio.
 *
 * El panel de `<input type="date">` lo dibuja el sistema y no acepta estilos:
 * no sigue el tema de la app ni su tipografía, y en la práctica se ve como una
 * pieza de otro programa. Este calendario es HTML normal, así que hereda los
 * mismos tokens que todo lo demás y funciona igual en claro y en oscuro.
 *
 * El panel se pinta en un portal a `document.body`, con posición fija
 * calculada a mano. Este campo casi siempre vive dentro de un modal con
 * scroll propio (`overflow-y-auto`); si el panel colgara del DOM local con
 * `position: absolute`, ese contenedor lo recorta apenas se abre cerca del
 * borde, y sus botones ("Cerrar", los días) quedan fuera del área que
 * realmente se puede tocar aunque se sigan viendo — de ahí que "no cierre".
 * Fuera del árbol del modal esa clase de recorte ya no aplica.
 */

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Alto aproximado del panel, para decidir si abre hacia arriba o hacia abajo. */
const ALTO_PANEL = 340

/** Casillas del mes empezando en lunes; `null` rellena los huecos iniciales. */
function rejillaDelMes(periodo: string): (string | null)[] {
  const [anio, mes] = periodo.split('-').map(Number)
  const total = diasDelPeriodo(periodo)
  const inicio = (new Date(anio, mes - 1, 1).getDay() + 6) % 7
  const casillas: (string | null)[] = Array.from({ length: inicio }, () => null)
  for (let dia = 1; dia <= total; dia++) {
    casillas.push(`${periodo}-${String(dia).padStart(2, '0')}`)
  }
  return casillas
}

interface Posicion {
  left: number
  ancho: number
  /** Distancia al borde superior del viewport (se usa si abre hacia abajo). */
  top: number
  /** Distancia al borde inferior del viewport (se usa si abre hacia arriba). */
  abajo: number
}

export function CampoFecha({
  valor,
  onCambio,
  id,
  min,
  max,
  locale = 'es-MX',
}: {
  valor: string
  onCambio: (fecha: string) => void
  id?: string
  min?: string
  max?: string
  locale?: string
}) {
  const t = useT()
  const generado = useId()
  const idCampo = id ?? generado
  const [abierto, setAbierto] = useState(false)
  const [mesVisible, setMesVisible] = useState(() => periodoDe(valor || hoyISO()))
  const [haciaArriba, setHaciaArriba] = useState(false)
  const [posicion, setPosicion] = useState<Posicion | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Al reabrir, el calendario vuelve al mes de la fecha elegida y no al último
  // que se estuvo hojeando.
  useEffect(() => {
    if (abierto) setMesVisible(periodoDe(valor || hoyISO()))
  }, [abierto, valor])

  // Mide dónde está el botón que abre el calendario y decide si el panel
  // abre hacia arriba o hacia abajo. Se repite en scroll/resize porque, al
  // vivir en un portal, el panel ya no se mueve solo con su contenedor: si
  // el modal que lo contiene se desplaza, hay que recalcular a mano.
  useEffect(() => {
    if (!abierto) return

    const medir = () => {
      const marco = disparador.current?.getBoundingClientRect()
      if (!marco) return
      setHaciaArriba(marco.bottom + ALTO_PANEL > window.innerHeight && marco.top > ALTO_PANEL)
      setPosicion({
        left: marco.left,
        ancho: marco.width,
        top: marco.bottom,
        abajo: window.innerHeight - marco.top,
      })
    }

    medir()
    window.addEventListener('resize', medir)
    // Captura: los contenedores con scroll propio (el modal) no burbujean
    // su evento `scroll` hasta `window`, pero sí lo cruzan en la fase de
    // captura.
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto])

  useEffect(() => {
    if (!abierto) return

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation()
        setAbierto(false)
        disparador.current?.focus()
      }
    }
    const alPulsarFuera = (evento: MouseEvent) => {
      const objetivo = evento.target as Node
      if (!contenedor.current?.contains(objetivo) && !panel.current?.contains(objetivo)) {
        setAbierto(false)
      }
    }

    document.addEventListener('keydown', alTeclear, true)
    document.addEventListener('mousedown', alPulsarFuera)
    return () => {
      document.removeEventListener('keydown', alTeclear, true)
      document.removeEventListener('mousedown', alPulsarFuera)
    }
  }, [abierto])

  const hoy = hoyISO()
  const casillas = rejillaDelMes(mesVisible)
  const fueraDeRango = (fecha: string) => (min !== undefined && fecha < min) || (max !== undefined && fecha > max)

  const textoVisible = valor
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(
        aFechaLocal(valor),
      )
    : t('comun.elegir_fecha')

  function elegir(fecha: string) {
    onCambio(fecha)
    setAbierto(false)
    disparador.current?.focus()
  }

  const estiloPanel: CSSProperties = posicion
    ? {
        position: 'fixed',
        left: posicion.left,
        width: '19rem',
        maxWidth: 'calc(100vw - 2.5rem)',
        ...(haciaArriba ? { bottom: posicion.abajo + 8 } : { top: posicion.top + 8 }),
      }
    : { position: 'fixed', visibility: 'hidden' }

  const reducido = useReducedMotion()
  // El picker es un dropdown contextual: la animación es más corta y más
  // direccional que la del modal genérico. En lugar de venir de abajo
  // (modal de pantalla completa), aparece desde el lado hacia el que se
  // abrió el campo.
  const transPicker = reducido
    ? { duration: 0.06, ease: 'linear' as const }
    : { type: 'spring' as const, stiffness: 520, damping: 36, mass: 0.6 }
  const origenY = haciaArriba ? -8 : 8

  // El portal se construye siempre, sin condicionar al `abierto`. Lo que se
  // condiciona es el contenido: el `motion.div` vive dentro de
  // `AnimatePresence`, que a su vez está dentro del portal. Si el portal
  // fuera condicional (`abierto ? createPortal(...) : null`), `AnimatePresence`
  // vería un `ReactPortal` como hijo y no detectaría bien el alta/baja, así
  // que el panel nunca se monta al abrir. Con el `AnimatePresence` adentro,
  // rastrea el `motion.div` directamente y la animación de entrada/salida
  // funciona como debe.
  const portal = createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-label={t('comun.elegir_fecha')}
          style={estiloPanel}
          initial={{ opacity: 0, y: origenY, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: origenY, scale: 0.97 }}
          transition={transPicker}
          className="z-50 rounded-tarjeta border border-borde bg-superficie p-3 shadow-flotante"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesVisible(sumarMeses(mesVisible, -1))}
              aria-label="Mes anterior"
              className="rounded-full p-1.5 text-suave transition-colors hover:bg-elevada hover:text-tinta"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span aria-live="polite" className="text-[15px] font-medium text-tinta capitalize">
              {nombrePeriodo(mesVisible)}
            </span>
            <button
              type="button"
              onClick={() => setMesVisible(sumarMeses(mesVisible, 1))}
              aria-label="Mes siguiente"
              className="rounded-full p-1.5 text-suave transition-colors hover:bg-elevada hover:text-tinta"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {DIAS.map((dia, i) => (
              <span key={`${dia}-${i}`} className="py-1 text-center text-[12px] font-medium text-tenue">
                {dia}
              </span>
            ))}

            {casillas.map((fecha, indice) => {
              if (fecha === null) return <span key={`hueco-${indice}`} />
              const numero = Number(fecha.slice(8, 10))
              const elegida = fecha === valor
              const esHoy = fecha === hoy
              const deshabilitada = fueraDeRango(fecha)
              return (
                <button
                  key={fecha}
                  type="button"
                  disabled={deshabilitada}
                  aria-current={esHoy ? 'date' : undefined}
                  aria-pressed={elegida}
                  onClick={() => elegir(fecha)}
                  className={clases(
                    'cifras flex aspect-square items-center justify-center rounded-full text-[14px] transition-colors',
                    elegida
                      ? 'bg-acento font-semibold text-sobre-acento'
                      : deshabilitada
                        ? 'text-tenue/40'
                        : 'text-tinta hover:bg-elevada',
                    esHoy && !elegida && 'ring-1 ring-acento',
                  )}
                >
                  {numero}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-borde pt-2">
            <button
              type="button"
              onClick={() => elegir(hoy)}
              disabled={fueraDeRango(hoy)}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-acento transition-colors hover:bg-elevada disabled:opacity-40"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                disparador.current?.focus()
              }}
              className="rounded-full px-3 py-1.5 text-[13px] text-suave transition-colors hover:bg-elevada hover:text-tinta"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )

  return (
    <div className="relative" ref={contenedor}>
      <button
        ref={disparador}
        id={idCampo}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={clases(
          'flex w-full items-center justify-between gap-2 rounded-campo border border-borde bg-superficie px-3.5 py-2.5',
          'text-left text-[15px] transition-shadow focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none',
          valor ? 'text-tinta' : 'text-tenue',
        )}
      >
        <span className="truncate">{textoVisible}</span>
        <CalendarDays className="size-[18px] shrink-0 text-acento" aria-hidden />
      </button>

      {portal}

      {/* Valor real para formularios y autocompletado; nunca se muestra. */}
      <input type="hidden" name={idCampo} value={valor} readOnly />
    </div>
  )
}
