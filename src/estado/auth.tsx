import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, borrarToken, guardarToken, obtenerToken } from '@/api/cliente'

/**
 * Estado de autenticación. Antes de tener backend, la app no necesitaba
 * "quién soy": los datos vivían en este dispositivo. Ahora sí: el JWT prueba
 * identidad contra el servidor, y `me` es el espejo del payload del token
 * (id, email).
 */

export interface Usuario {
  id: string
  email: string
  displayName: string
}

export interface AuthEstado {
  /** Mientras revisamos el token guardado al cargar. */
  iniciando: boolean
  /** Hay un JWT válido y conocemos al usuario. */
  autenticado: boolean
  usuario: Usuario | null
  login: (email: string, password: string) => Promise<{ ok: boolean; error: string | null }>
  registrar: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ ok: boolean; error: string | null }>
  cerrarSesion: () => void
}

const Contexto = createContext<AuthEstado | null>(null)

interface SesionRespuesta {
  accessToken: string
  user: { id: string; email: string }
}

interface MeRespuesta {
  id: string
  email: string
  displayName: string
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [iniciando, setIniciando] = useState(true)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  // Al montar, si hay token en localStorage, preguntamos al backend quién
  // somos. Si falla (401, red), limpiamos el token y dejamos la app en
  // "no autenticado" para que muestre el login.
  useEffect(() => {
    const token = obtenerToken()
    if (!token) {
      setIniciando(false)
      return
    }
    api
      .get<MeRespuesta>('/auth/me')
      .then((res) => {
        if (res.ok && res.data) {
          setUsuario({
            id: res.data.id,
            email: res.data.email,
            displayName: res.data.displayName,
          })
        } else if (res.status === 401) {
          borrarToken()
        }
      })
      .finally(() => setIniciando(false))
  }, [])

  const login = useCallback<AuthEstado['login']>(async (email, password) => {
    const res = await api.post<SesionRespuesta>('/auth/login', { email, password })
    if (!res.ok || !res.data) return { ok: false, error: res.error }
    guardarToken(res.data.accessToken)
    // El login solo trae id+email; el displayName viene de /auth/me.
    const me = await api.get<MeRespuesta>('/auth/me')
    if (me.ok && me.data) {
      setUsuario({
        id: me.data.id,
        email: me.data.email,
        displayName: me.data.displayName,
      })
    }
    return { ok: true, error: null }
  }, [])

  const registrar = useCallback<AuthEstado['registrar']>(async (email, password, displayName) => {
    const res = await api.post<SesionRespuesta>('/auth/register', { email, password, displayName })
    if (!res.ok || !res.data) return { ok: false, error: res.error }
    guardarToken(res.data.accessToken)
    const me = await api.get<MeRespuesta>('/auth/me')
    if (me.ok && me.data) {
      setUsuario({
        id: me.data.id,
        email: me.data.email,
        displayName: me.data.displayName,
      })
    }
    return { ok: true, error: null }
  }, [])

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const valor: AuthEstado = {
    iniciando,
    autenticado: usuario !== null,
    usuario,
    login,
    registrar,
    cerrarSesion,
  }

  return <Contexto value={valor}>{children}</Contexto>
}

export function useAuth(): AuthEstado {
  const valor = use(Contexto)
  if (!valor) throw new Error('useAuth necesita estar dentro de ProveedorAuth')
  return valor
}
