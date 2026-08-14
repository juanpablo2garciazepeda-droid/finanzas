import { useState, type FormEvent } from 'react'
import { LockKeyhole, Mail } from 'lucide-react'
import { Boton, Campo, Entrada, Tarjeta, clases } from '@/componentes/ui/Basicos'
import { useAuth } from '@/estado/auth'

/**
 * Pantalla de acceso. Antes era un candado con PIN; ahora es el login contra
 * el backend. Mantiene el mismo aspecto (icono + nombre de la app) para que
 * un usuario volviendo no se sorprenda.
 */
export function Login() {
  const auth = useAuth()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const resultado =
      modo === 'login'
        ? await auth.login(email.trim(), password)
        : await auth.registrar(email.trim(), password, displayName.trim() || email.split('@')[0])
    setCargando(false)
    if (!resultado.ok) setError(resultado.error ?? 'Algo falló. Inténtalo de nuevo.')
  }

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
            <Entrada
              id="password"
              type="password"
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </Campo>

          {error && <p className="text-[13px] text-rojo">{error}</p>}

          <Boton type="submit" disabled={cargando} ancho>
            {cargando ? 'Espera…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Boton>
        </form>
      </Tarjeta>

      <button
        type="button"
        onClick={() => {
          setModo(modo === 'login' ? 'registro' : 'login')
          setError(null)
        }}
        className={clases('text-[14px] text-acento hover:underline')}
      >
        {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
      </button>
    </div>
  )
}
