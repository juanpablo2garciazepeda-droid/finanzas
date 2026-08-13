import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { aFechaLocal, diasDelPeriodo, hoyISO, nombrePeriodo, periodoDe, sumarMeses } from '@/dominio/fechas'
import { clases } from './Basicos'

/**
 * Selector de fecha propio.
 *
 * El panel de `<input type="date">` lo dibuja el sistema y no acepta estilos:
 * no sigue el tema de la app ni su tipografía, y en la práctica se ve como una
 * pieza de otro programa. Este calendario es HTML normal, así que hereda los
 * mismos tokens que todo lo demás y funciona igual en claro y en oscuro.
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
  const generado = useId()
  const idCampo = id ?? generado
  const [abierto, setAbierto] = useState(false)
  const [mesVisible, setMesVisible] = useState(() => periodoDe(valor || hoyISO()))
  const [haciaArriba, setHaciaArriba] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Al reabrir, el calendario vuelve al mes de la fecha elegida y no al último
  // que se estuvo hojeando.
  useEffect(() => {
    if (abierto) setMesVisible(periodoDe(valor || hoyISO()))
  }, [abierto, valor])

  // Abrir hacia abajo deja el calendario fuera de la pantalla cuando el campo
  // está al final del formulario. Se mide antes de pintar para no ver el salto.
  useEffect(() => {
    if (!abierto) return
    const marco = disparador.current?.getBoundingClientRect()
    if (marco) setHaciaArriba(marco.bottom + ALTO_PANEL > window.innerHeight && marco.top > ALTO_PANEL)
    panel.current?.scrollIntoView({ block: 'nearest' })
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
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
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
    : 'Elegir fecha'

  function elegir(fecha: string) {
    onCambio(fecha)
    setAbierto(false)
    disparador.current?.focus()
  }

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

      {abierto && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Elegir fecha"
          className={clases(
            'animar-entrada absolute z-50 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-tarjeta border border-borde bg-superficie p-3 shadow-flotante',
            haciaArriba ? 'bottom-full mb-2' : 'mt-2',
          )}
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
        </div>
      )}

      {/* Valor real para formularios y autocompletado; nunca se muestra. */}
      <input type="hidden" name={idCampo} value={valor} readOnly />
    </div>
  )
}
