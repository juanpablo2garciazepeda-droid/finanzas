import { useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Boton, Campo, Entrada, Tarjeta, clases } from '@/componentes/ui/Basicos'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'
import { Check, X } from 'lucide-react'

/**
 * Página a la que llega el usuario al picar el enlace de "olvidé mi
 * contraseña". Leemos el `token` del query, pedimos la nueva contraseña,
 * y al éxito deslogueamos (todas las sesiones anteriores quedan invalidadas
 * en el backend) y mandamos al login.
 */
export function RestablecerPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const { mostrar } = useAvisos()
  const token = useMemo(
    () => new URLSearchParams(location.search).get('token') ?? '',
    [location.search],
  )
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarPw, setMostrarPw] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const Fortaleza = useMemo(() => fortaleza(password), [password])
  const coinciden = confirmar.length === 0 || confirmar === password

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Falta el token. Abre el enlace que te enviamos por correo.')
      return
    }
    if (!Fortaleza.cumple) {
      setError(Fortaleza.mensaje)
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    const res = await api.post<{ user: { email: string } }>(
      '/auth/restablecer-password',
      { token, password },
    )
    setCargando(false)
    if (!res.ok) {
      setError(res.error ?? 'No se pudo restablecer la contraseña.')
      return
    }
    mostrar('Contraseña actualizada. Inicia sesión con la nueva.')
    auth.cerrarSesion()
    navigate('/')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
      <Tarjeta className="w-full max-w-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-acento/10">
            <Lock className="size-4 text-acento" aria-hidden />
          </span>
          <h1 className="font-display text-[19px] font-semibold text-tinta">
            Nueva contraseña
          </h1>
        </div>
        <p className="mb-4 text-[14px] text-suave">
          Elige una contraseña nueva para tu cuenta. Al guardarla cerraremos
          las sesiones en otros dispositivos.
        </p>

        <form onSubmit={enviar} className="space-y-4">
          <Campo etiqueta="Nueva contraseña" htmlFor="password">
            <div className="relative">
              <Entrada
                id="password"
                type={mostrarPw ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setMostrarPw(!mostrarPw)}
                aria-label={mostrarPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-tenue hover:text-tinta"
              >
                {mostrarPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <MedidorFortaleza
              nivel={Fortaleza.nivel}
              cumple={Fortaleza.cumple}
              mensaje={Fortaleza.mensaje}
            />
          </Campo>
          <Campo
            etiqueta="Repite la contraseña"
            htmlFor="confirmar"
            error={!coinciden ? 'Las contraseñas no coinciden.' : undefined}
          >
            <Entrada
              id="confirmar"
              type={mostrarPw ? 'text' : 'password'}
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Para confirmar"
            />
          </Campo>

          {error && <p className="text-[13px] text-rojo">{error}</p>}

          <Boton type="submit" disabled={cargando} ancho>
            {cargando ? 'Guardando…' : 'Guardar contraseña'}
          </Boton>
        </form>
      </Tarjeta>
    </div>
  )
}

interface Fortaleza {
  nivel: 0 | 1 | 2 | 3 | 4
  cumple: boolean
  mensaje: string
}

function fortaleza(p: string): Fortaleza {
  if (p.length === 0) return { nivel: 0, cumple: false, mensaje: '' }
  let puntos = 0
  if (p.length >= 8) puntos++
  if (p.length >= 12) puntos++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) puntos++
  if (/[0-9]/.test(p)) puntos++
  if (/[^A-Za-z0-9]/.test(p)) puntos++
  const nivel = Math.min(4, puntos) as 0 | 1 | 2 | 3 | 4
  const cumple = p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)
  const mensaje = cumple
    ? 'Contraseña aceptable.'
    : 'Usa al menos 8 caracteres con mayúscula, minúscula y un número.'
  return { nivel, cumple, mensaje }
}

function MedidorFortaleza({
  nivel,
  cumple,
  mensaje,
}: {
  nivel: 0 | 1 | 2 | 3 | 4
  cumple: boolean
  mensaje: string
}) {
  const etiquetas = ['—', 'débil', 'regular', 'bien', 'fuerte', 'excelente'] as const
  const colores = ['bg-hundida', 'bg-rojo', 'bg-ambar', 'bg-ambar', 'bg-verde', 'bg-verde'] as const
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clases(
              'h-1 flex-1 rounded-full transition-colors',
              i <= nivel && nivel > 0 ? colores[nivel] : 'bg-hundida',
            )}
            aria-hidden
          />
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-tenue">
        {cumple ? (
          <Check className="size-3 text-verde" aria-hidden />
        ) : (
          <X className="size-3 text-rojo" aria-hidden />
        )}
        <span>
          Fortaleza: {etiquetas[nivel]} · {mensaje}
        </span>
      </div>
    </div>
  )
}
