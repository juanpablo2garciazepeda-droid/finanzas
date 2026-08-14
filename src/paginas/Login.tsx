import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { Boton, Campo, Entrada } from '@/componentes/ui/Basicos'
import { BarraPublica } from './Landing'
import { useAuth } from '@/estado/auth'

/**
 * Inicio de sesión, y nada más.
 *
 * Antes esta pantalla era también el registro: un solo formulario que cambiaba
 * de forma según un botón al pie, con campos que aparecían y desaparecían. Eso
 * obligaba a que cada control cargara con dos significados —"Contraseña" es
 * "la tuya" o "inventa una" según el modo— y hacía imposible enlazar directo
 * al alta. El registro vive ahora en `/crear-cuenta`, con su propio flujo.
 */
export function Login() {
  const auth = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const resultado = await auth.login(email.trim(), password, recordar)
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error ?? 'Algo falló. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />

      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <div className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta sm:p-8">
          <h1 className="font-display text-[clamp(1.5rem,5vw,1.75rem)] leading-tight font-semibold tracking-[-0.03em] text-tinta">
            Entra a tu cuenta
          </h1>
          <p className="mt-2 text-[15px] text-suave">Para ver cuánto puedes gastar hoy.</p>

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

            <Campo etiqueta="Contraseña" htmlFor="password">
              <div className="relative">
                <Entrada
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="py-3 pr-11 text-[16px]"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-tenue transition-colors hover:text-tinta"
                >
                  {verPassword ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
            </Campo>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <label className="flex items-center gap-2 text-[14px] text-suave">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="size-4 accent-acento"
                />
                Mantener sesión
              </label>
              <Link to="/olvide-password" className="text-[14px] text-acento hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-rojo">
                {error}
              </p>
            )}

            <Boton type="submit" disabled={cargando} ancho className="py-3 text-[16px]">
              {cargando ? 'Entrando…' : 'Entrar'}
            </Boton>
          </form>
        </div>

        <p className="mt-6 text-center text-[15px] text-suave">
          ¿No tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => navegar('/crear-cuenta')}
            className="font-medium text-acento hover:underline"
          >
            Créala en un minuto
          </button>
        </p>
      </div>
    </div>
  )
}
