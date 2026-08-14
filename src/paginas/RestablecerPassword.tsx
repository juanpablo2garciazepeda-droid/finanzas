import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Boton, Campo, Entrada } from '@/componentes/ui/Basicos'
import { MedidorFortaleza, fortalezaPassword } from '@/componentes/FortalezaPassword'
import { BarraPublica } from './Landing'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'

/**
 * Destino del enlace de "olvidé mi contraseña". Al guardar, el backend sube el
 * `tokenVersion` del usuario, lo que invalida las sesiones abiertas en otros
 * aparatos; la pantalla lo dice antes de que pase, no después.
 */
export function RestablecerPassword() {
  const location = useLocation()
  const navegar = useNavigate()
  const auth = useAuth()
  const { mostrar } = useAvisos()

  const token = useMemo(
    () => new URLSearchParams(location.search).get('token') ?? '',
    [location.search],
  )
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fuerza = useMemo(() => fortalezaPassword(password), [password])
  const coinciden = confirmar.length === 0 || confirmar === password

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Falta el token. Abre el enlace tal como llegó en el correo.')
      return
    }
    if (!fuerza.cumple) {
      setError(fuerza.mensaje)
      return
    }
    if (password !== confirmar) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setCargando(true)
    const res = await api.post('/auth/restablecer-password', { token, password })
    setCargando(false)
    if (!res.ok) {
      setError(res.error ?? 'No se pudo cambiar la contraseña.')
      return
    }
    mostrar('Contraseña actualizada. Entra con la nueva.')
    auth.cerrarSesion()
    navegar('/entrar')
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />

      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <div className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta sm:p-8">
          <h1 className="font-display text-[clamp(1.5rem,5vw,1.75rem)] leading-tight font-semibold tracking-[-0.03em] text-tinta">
            Elige una contraseña nueva
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-suave">
            Al guardarla cerramos la sesión en los demás dispositivos.
          </p>

          {!token && (
            <p role="alert" className="mt-5 rounded-campo bg-rojo/10 px-3.5 py-3 text-[14px] text-rojo">
              Este enlace viene incompleto. Vuelve a pedirlo desde{' '}
              <Link to="/olvide-password" className="underline">
                ¿olvidaste tu contraseña?
              </Link>
            </p>
          )}

          <form onSubmit={enviar} className="mt-6 space-y-4">
            <Campo etiqueta="Nueva contraseña" htmlFor="password">
              <div className="relative">
                <Entrada
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
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
              <MedidorFortaleza fuerza={fuerza} />
            </Campo>

            <Campo
              etiqueta="Repítela"
              htmlFor="confirmar"
              error={!coinciden ? 'Las dos contraseñas no coinciden.' : undefined}
            >
              <Entrada
                id="confirmar"
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Para confirmar"
                className="py-3 text-[16px]"
              />
            </Campo>

            {error && (
              <p role="alert" className="text-[13px] text-rojo">
                {error}
              </p>
            )}

            <Boton
              type="submit"
              disabled={cargando || !token}
              ancho
              className="py-3 text-[16px]"
            >
              {cargando ? 'Guardando…' : 'Guardar contraseña'}
            </Boton>
          </form>
        </div>
      </div>
    </div>
  )
}
