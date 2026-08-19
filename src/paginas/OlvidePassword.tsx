import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Mail, MailCheck } from 'lucide-react'
import { Boton, Campo, Entrada } from '@/componentes/ui/Basicos'
import { BarraPublica } from './Landing'
import { api } from '@/api/cliente'
import { useAvisos } from '@/estado/avisos'

/**
 * "Olvidé mi contraseña".
 *
 * El backend responde siempre lo mismo exista o no el correo, y esta pantalla
 * hace lo propio: confirmar que una dirección está registrada le regala a
 * cualquiera una lista de clientes.
 */
export function OlvidePassword() {
  const { mostrar } = useAvisos()
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    const res = await api.post<{ mensaje: string }>('/auth/olvide-password', {
      email: email.trim(),
    })
    setCargando(false)
    if (res.ok) {
      setEnviado(true)
    } else {
      mostrar(res.error ?? 'Algo falló. Inténtalo de nuevo.', 'error')
    }
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />

      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <div className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta sm:p-8">
          {enviado ? (
            <div className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-verde/12">
                <MailCheck className="size-7 text-verde" strokeWidth={1.75} aria-hidden />
              </span>
              <h1 className="mt-4 font-display text-[clamp(1.375rem,4.5vw,1.625rem)] font-semibold tracking-[-0.03em] text-tinta">
                Revisa tu correo
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-suave">
                {/* Los minutos los manda el backend: la verdad vive en
                    MINUTOS_RESET de apps/backend/src/auth/caducidad.ts. Si
                    cambia allá y este número se queda, la pantalla miente. */}
                Si <strong className="font-medium text-tinta">{email.trim()}</strong> tiene
                una cuenta, ahí está el enlace para elegir una contraseña nueva. Vence en
                10 minutos y solo sirve una vez.
              </p>
              <p className="mt-3 text-[13px] text-tenue">
                ¿No aparece? Mira en spam antes de volver a pedirlo.
              </p>
              <Link
                to="/entrar"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-borde bg-superficie px-5 py-[11px] text-[15px] text-acento transition-colors hover:bg-elevada"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <Link
                to="/entrar"
                className="mb-4 inline-flex items-center gap-1 text-[13px] text-suave transition-colors hover:text-tinta"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Volver
              </Link>
              <h1 className="font-display text-[clamp(1.5rem,5vw,1.75rem)] leading-tight font-semibold tracking-[-0.03em] text-tinta">
                Recupera tu contraseña
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-suave">
                Dinos con qué correo entras y te mandamos un enlace para elegir una nueva.
              </p>

              <form onSubmit={enviar} className="mt-7 space-y-4">
                <Campo etiqueta="Correo" htmlFor="email">
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-tenue"
                      aria-hidden
                    />
                    <Entrada
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="py-3 pl-11 text-[16px]"
                    />
                  </div>
                </Campo>
                <Boton type="submit" disabled={cargando} ancho className="py-3 text-[16px]">
                  {cargando ? 'Enviando…' : 'Enviar enlace'}
                </Boton>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
