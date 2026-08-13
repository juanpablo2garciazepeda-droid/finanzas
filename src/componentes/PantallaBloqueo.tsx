import { useEffect, useRef, useState } from 'react'
import { Delete, LockKeyhole } from 'lucide-react'
import { abrirSesion, pinCorrecto } from '@/estado/bloqueo'
import { Boton, clases } from './ui/Basicos'

const LARGO = 4
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']

/**
 * Pantalla de entrada. Teclado propio de cuatro dígitos porque en el celular
 * es lo que se usa con una mano, y el teclado del sistema tapa media pantalla.
 */
export function PantallaBloqueo({ onEntrar }: { onEntrar: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [comprobando, setComprobando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    campo.current?.focus()
  }, [])

  useEffect(() => {
    if (pin.length !== LARGO || comprobando) return
    setComprobando(true)
    void pinCorrecto(pin).then((correcto) => {
      if (correcto) {
        abrirSesion()
        onEntrar()
        return
      }
      setError(true)
      setPin('')
      setComprobando(false)
      // Se limpia el aviso para que el siguiente intento no arrastre el rojo.
      setTimeout(() => setError(false), 1600)
    })
  }, [pin, comprobando, onEntrar])

  function teclear(tecla: string) {
    if (tecla === 'borrar') {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (tecla === '' || pin.length >= LARGO) return
    setPin((p) => p + tecla)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-fondo px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[16px] bg-acento">
          <LockKeyhole className="size-7 text-sobre-acento" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="font-display text-[24px] font-semibold text-tinta">Juanpa Finanzas</h1>
        <p className={clases('text-[15px]', error ? 'text-rojo' : 'text-suave')} role="status">
          {error ? 'Ese no es tu PIN. Inténtalo otra vez.' : 'Escribe tu PIN para entrar'}
        </p>
      </div>

      {/* Teclado físico: el campo invisible acepta números del teclado real. */}
      <input
        ref={campo}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, LARGO))}
        inputMode="numeric"
        autoComplete="off"
        aria-label="PIN"
        className="sr-only"
      />

      <div className={clases('flex gap-4', error && 'animar-pulso')} aria-hidden>
        {Array.from({ length: LARGO }, (_, i) => (
          <span
            key={i}
            className={clases(
              'size-4 rounded-full transition-colors',
              i < pin.length ? 'bg-acento' : 'bg-hundida',
            )}
          />
        ))}
      </div>

      <div className="grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) =>
          tecla === '' ? (
            <span key={`hueco-${i}`} />
          ) : (
            <button
              key={tecla}
              type="button"
              onClick={() => teclear(tecla)}
              aria-label={tecla === 'borrar' ? 'Borrar' : tecla}
              className={clases(
                'cifras flex aspect-square items-center justify-center rounded-full text-[24px] font-medium transition-colors',
                tecla === 'borrar'
                  ? 'text-suave hover:bg-elevada'
                  : 'bg-superficie text-tinta shadow-tarjeta hover:bg-elevada',
              )}
            >
              {tecla === 'borrar' ? <Delete className="size-6" aria-hidden /> : tecla}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/** Formulario para fijar o cambiar el PIN desde Ajustes. */
export function FormularioPin({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (pin: string) => void
  onCancelar: () => void
}) {
  const [pin, setPin] = useState('')
  const [repetir, setRepetir] = useState('')

  const completo = pin.length === LARGO && repetir.length === LARGO
  const coincide = completo && pin === repetir

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (coincide) onGuardar(pin)
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-suave">PIN de 4 dígitos</span>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, LARGO))}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          className="cifras w-full rounded-campo border border-borde bg-superficie px-3.5 py-2.5 text-center text-2xl tracking-[0.5em] text-tinta focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-suave">Repítelo</span>
        <input
          value={repetir}
          onChange={(e) => setRepetir(e.target.value.replace(/\D/g, '').slice(0, LARGO))}
          inputMode="numeric"
          autoComplete="off"
          className="cifras w-full rounded-campo border border-borde bg-superficie px-3.5 py-2.5 text-center text-2xl tracking-[0.5em] text-tinta focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none"
        />
      </label>

      {completo && !coincide && <p className="text-[13px] text-rojo">Los dos PIN no coinciden.</p>}

      <p className="text-[13px] text-tenue">
        Si lo olvidas no hay forma de recuperarlo: tendrías que borrar los datos del sitio y empezar
        de cero. Guarda un respaldo antes.
      </p>

      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onCancelar} className="flex-1">
          Cancelar
        </Boton>
        <Boton type="submit" disabled={!coincide} className="flex-1">
          Activar
        </Boton>
      </div>
    </form>
  )
}
