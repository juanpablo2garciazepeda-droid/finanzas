import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Send,
  X,
} from 'lucide-react'
import { Boton, Campo, Entrada, Tarjeta, clases } from '@/componentes/ui/Basicos'
import { useAuth } from '@/estado/auth'
import { api } from '@/api/cliente'
import { useAvisos } from '@/estado/avisos'

type Modo = 'login' | 'registro'
type EstadoRegistro = 'form' | 'verifica-email' | 'ya-registrado'

/**
 * Pantalla de acceso contra el backend.
 *
 * Tres vistas según lo que pasó al registrar:
 *   1. form             — el usuario está tipeando credenciales
 *   2. verifica-email   — la cuenta se creó, le decimos a qué correo
 *                         mandamos el link, y damos opción de reenviar
 *   3. ya-registrado    — el correo ya estaba, le decimos con claridad y
 *                         le damos opciones (login / recuperar contraseña)
 *
 * Antes el mensaje era siempre genérico ("si el correo no estaba…") y
 * eso confundía: el usuario se quedaba esperando un email que nunca
 * llegaba cuando en realidad su cuenta ya existía.
 */
export function Login() {
  const auth = useAuth()
  const { mostrar } = useAvisos()
  const [modo, setModo] = useState<Modo>('login')
  const [estado, setEstado] = useState<EstadoRegistro>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [terminos, setTerminos] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [reenviando, setReenviando] = useState(false)

  const Fortaleza = useMemo(() => fortalezaPassword(password), [password])
  const passwordsCoinciden = confirmar.length === 0 || confirmar === password

  function limpiarYVolverAlForm() {
    setEstado('form')
    setError(null)
  }

  function reiniciarParaLogin() {
    limpiarYVolverAlForm()
    setModo('login')
    setPassword('')
    setConfirmar('')
    setTerminos(false)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (modo === 'registro') {
      if (!Fortaleza.cumple) {
        setError(Fortaleza.mensaje)
        return
      }
      if (password !== confirmar) {
        setError('Las contraseñas no coinciden.')
        return
      }
      if (!terminos) {
        setError('Acepta los términos y el aviso de privacidad para continuar.')
        return
      }
    }
    setCargando(true)
    if (modo === 'login') {
      const resultado = await auth.login(email.trim(), password, recordar)
      setCargando(false)
      if (!resultado.ok) {
        setError(resultado.error ?? 'Algo falló. Inténtalo de nuevo.')
      }
      return
    }
    const resultado = await auth.registrar(
      email.trim(),
      password,
      displayName.trim() || email.split('@')[0],
    )
    setCargando(false)
    if (!resultado.ok) {
      // 409 → el correo ya existe. Cambio a vista dedicada en vez de mostrar
      // un error genérico en el formulario.
      if (resultado.status === 409) {
        setEstado('ya-registrado')
        return
      }
      setError(resultado.error ?? 'Algo falló. Inténtalo de nuevo.')
      return
    }
    setEstado('verifica-email')
  }

  async function reenviarVerificacion() {
    setReenviando(true)
    const res = await api.post('/auth/reenviar-verificacion', { email: email.trim() })
    setReenviando(false)
    if (res.ok) {
      mostrar('Reenviamos el correo. Revisa spam si no llega en un par de minutos.')
    } else {
      mostrar(res.error ?? 'No se pudo reenviar', 'error')
    }
  }

  // ── Vista: "verifica tu correo" tras registro exitoso ──
  if (estado === 'verifica-email') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-[16px] bg-acento">
            <Mail className="size-7 text-sobre-acento" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="font-display text-[24px] font-semibold text-tinta">
            Revisa tu correo
          </h1>
          <p className="text-[15px] text-suave max-w-sm">
            Te enviamos un link a{' '}
            <strong className="text-tinta">{email.trim()}</strong> para terminar de crear tu
            cuenta. Ábrelo y te llevamos al tablero.
          </p>
        </div>

        <Tarjeta className="w-full max-w-sm space-y-3">
          <p className="text-[13px] text-suave">
            ¿No llegó? Revisa la carpeta de spam o reenvíalo.
          </p>
          <Boton
            variante="secundario"
            disabled={reenviando}
            onClick={reenviarVerificacion}
            ancho
          >
            <Send className="size-4" aria-hidden />
            {reenviando ? 'Reenviando…' : 'Reenviar correo de verificación'}
          </Boton>
          <Boton variante="fantasma" onClick={reiniciarParaLogin} ancho>
            <ArrowLeft className="size-4" aria-hidden />
            Volver al inicio de sesión
          </Boton>
        </Tarjeta>
      </div>
    )
  }

  // ── Vista: "este correo ya está registrado" ──
  if (estado === 'ya-registrado') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-[16px] bg-ambar/15">
            <KeyRound className="size-7 text-ambar" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="font-display text-[24px] font-semibold text-tinta">
            Ya tienes cuenta
          </h1>
          <p className="text-[15px] text-suave max-w-sm">
            El correo <strong className="text-tinta">{email.trim()}</strong> ya está
            registrado. Inicia sesión o recupera tu contraseña.
          </p>
        </div>

        <Tarjeta className="w-full max-w-sm space-y-2">
          <Boton
            onClick={() => {
              setModo('login')
              setPassword('')
              limpiarYVolverAlForm()
            }}
            ancho
          >
            <LockKeyhole className="size-4" aria-hidden />
            Iniciar sesión
          </Boton>
          <Link
            to="/olvide-password"
            className={clases(
              'flex w-full items-center justify-center gap-2 rounded-full border border-borde bg-elevada px-5 py-[11px] text-[15px] text-acento transition-colors hover:bg-hundida',
            )}
            onClick={limpiarYVolverAlForm}
          >
            <KeyRound className="size-4" aria-hidden />
            Recuperar contraseña
          </Link>
          <Boton variante="fantasma" onClick={limpiarYVolverAlForm} ancho>
            <ArrowLeft className="size-4" aria-hidden />
            Usar otro correo
          </Boton>
        </Tarjeta>
      </div>
    )
  }

  // ── Vista: formulario (login o registro) ──
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[16px] bg-acento">
          <LockKeyhole className="size-7 text-sobre-acento" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="font-display text-[24px] font-semibold text-tinta">Juanpa Finanzas</h1>
        <p className="text-[15px] text-suave">
          {modo === 'login' ? 'Entra con tu cuenta' : 'Crea tu cuenta'}
        </p>
      </div>

      <Tarjeta className="w-full max-w-sm">
        <form onSubmit={enviar} className="space-y-4">
          {modo === 'registro' && (
            <Campo etiqueta="Nombre" htmlFor="displayName">
              <Entrada
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cómo quieres que te diga la app"
              />
            </Campo>
          )}

          <Campo etiqueta="Correo" htmlFor="email">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
                aria-hidden
              />
              <Entrada
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="pl-9"
              />
            </div>
          </Campo>

          <Campo etiqueta="Contraseña" htmlFor="password">
            <div className="relative">
              <Entrada
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-tenue hover:text-tinta"
              >
                {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {modo === 'registro' && (
              <MedidorFortaleza
                nivel={Fortaleza.nivel}
                cumple={Fortaleza.cumple}
                mensaje={Fortaleza.mensaje}
              />
            )}
          </Campo>

          {modo === 'registro' && (
            <Campo
              etiqueta="Repite la contraseña"
              htmlFor="confirmar"
              error={
                !passwordsCoinciden ? 'Las contraseñas no coinciden.' : undefined
              }
            >
              <Entrada
                id="confirmar"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Para confirmar"
              />
            </Campo>
          )}

          {modo === 'registro' && (
            <label className="flex items-start gap-2 text-[13px] text-suave">
              <input
                type="checkbox"
                checked={terminos}
                onChange={(e) => setTerminos(e.target.checked)}
                className="mt-0.5 size-4 accent-acento"
                required
              />
              <span>
                Acepto los{' '}
                <Link
                  to="/aviso-privacidad"
                  target="_blank"
                  rel="noopener"
                  className="text-acento underline-offset-2 hover:underline"
                >
                  términos y el aviso de privacidad
                </Link>
                .
              </span>
            </label>
          )}

          {modo === 'login' && (
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[13px] text-suave">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="size-4 accent-acento"
                />
                Recordarme
              </label>
              <Link
                to="/olvide-password"
                className="text-[13px] text-acento hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}

          {error && <p className="text-[13px] text-rojo">{error}</p>}

          <Boton type="submit" disabled={cargando} ancho>
            {cargando
              ? 'Espera…'
              : modo === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
          </Boton>
        </form>
      </Tarjeta>

      <button
        type="button"
        onClick={() => {
          setModo(modo === 'login' ? 'registro' : 'login')
          setError(null)
          setConfirmar('')
          setTerminos(false)
        }}
        className={clases('text-[14px] text-acento hover:underline')}
      >
        {modo === 'login'
          ? '¿No tienes cuenta? Regístrate'
          : '¿Ya tienes cuenta? Entra'}
      </button>
    </div>
  )
}

// ── Medidor de fortaleza (cliente, antes de enviar) ─────────────────────

interface Fortaleza {
  nivel: 0 | 1 | 2 | 3 | 4
  cumple: boolean
  mensaje: string
}

function fortalezaPassword(p: string): Fortaleza {
  if (p.length === 0) {
    return { nivel: 0, cumple: false, mensaje: '' }
  }
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
