import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Mail } from 'lucide-react'
import { Boton, Campo, Entrada, Tarjeta } from '@/componentes/ui/Basicos'
import { api } from '@/api/cliente'
import { useAvisos } from '@/estado/avisos'

/**
 * "Olvidé mi contraseña". El backend siempre responde con un mensaje
 * genérico (no revela si el correo existe), así que la UI nunca confirma
 * ni niega el registro de un email.
 */
export function OlvidePassword() {
  const { mostrar } = useAvisos()
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    const res = await api.post<{ mensaje: string }>('/auth/olvide-password', { email: email.trim() })
    setCargando(false)
    if (res.ok) {
      setEnviado(true)
      mostrar('Si el correo está registrado, recibirás un enlace')
    } else {
      mostrar(res.error ?? 'Algo falló', 'error')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
      <Tarjeta className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-suave hover:text-tinta"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Link>
        <h1 className="font-display text-[20px] font-semibold text-tinta">
          Restablecer contraseña
        </h1>
        <p className="mt-1 text-[14px] text-suave">
          Te enviaremos un enlace por correo para que puedas elegir una nueva.
        </p>

        {enviado ? (
          <div
            className="mt-4 rounded-campo border border-verde/30 bg-verde/10 px-3 py-2.5 text-[13px] text-verde"
            role="status"
          >
            Si el correo está registrado, te enviamos un enlace. Revisa también la carpeta de spam.
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-4 space-y-4">
            <Campo etiqueta="Correo" htmlFor="email">
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
                  aria-hidden
                />
                <Entrada
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="pl-9"
                />
              </div>
            </Campo>
            <Boton type="submit" disabled={cargando} ancho>
              {cargando ? 'Enviando…' : 'Enviar enlace'}
            </Boton>
          </form>
        )}
      </Tarjeta>
    </div>
  )
}
