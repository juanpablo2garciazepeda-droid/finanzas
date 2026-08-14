import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, borrarToken, guardarToken, obtenerToken } from '@/api/cliente'

/**
 * Estado de autenticación.
 *
 * - El JWT vive en localStorage (mismo navegador).
 * - `emailVerificado` se trae de /auth/me, que devuelve el user completo.
 * - Si el backend rechaza el token (401, "sesión revocada"), deslogueamos
 *   y dejamos que la UI muestre el login otra vez.
 */

export interface Usuario {
  id: string
  email: string
  displayName: string
  emailVerificado: boolean
  rol: 'usuario' | 'admin'
  debeCambiarPassword: boolean
  idioma: 'es' | 'en'
  recibirDigest: boolean
}

export interface AuthEstado {
  iniciando: boolean
  autenticado: boolean
  usuario: Usuario | null
  login: (
    email: string,
    password: string,
    recordar: boolean,
  ) => Promise<{ ok: boolean; error: string | null }>
  registrar: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ ok: boolean; error: string | null; mensaje?: string }>
  cerrarSesion: () => void
  refrescar: () => Promise<void>
}

const Contexto = createContext<AuthEstado | null>(null)

interface SesionRespuesta {
  accessToken: string
  user: PublicUserApi
}

interface PublicUserApi {
  id: string
  email: string
  displayName: string
  emailVerificado: boolean
  rol: 'usuario' | 'admin'
  debeCambiarPassword: boolean
  idioma: 'es' | 'en'
  recibirDigest: boolean
  creadoEn: string
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [iniciando, setIniciando] = useState(true)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  // Centraliza la lógica de "traducir respuesta del backend a Usuario local".
  const hidratar = useCallback(async () => {
    const me = await api.get<PublicUserApi>('/auth/me')
    if (me.ok && me.data) {
      setUsuario({
        id: me.data.id,
        email: me.data.email,
        displayName: me.data.displayName,
        emailVerificado: me.data.emailVerificado,
        rol: me.data.rol,
        debeCambiarPassword: me.data.debeCambiarPassword,
        idioma: me.data.idioma ?? 'es',
        recibirDigest: me.data.recibirDigest ?? true,
      })
      return true
    }
    if (me.status === 401) {
      borrarToken()
      setUsuario(null)
    }
    return false
  }, [])

  useEffect(() => {
    const token = obtenerToken()
    if (!token) {
      setIniciando(false)
      return
    }
    void hidratar().finally(() => setIniciando(false))
  }, [hidratar])

  const login = useCallback<AuthEstado['login']>(
    async (email, password, recordar) => {
      const res = await api.post<SesionRespuesta>('/auth/login', {
        email,
        password,
        recordar,
      })
      if (!res.ok || !res.data) return { ok: false, error: res.error }
      guardarToken(res.data.accessToken, recordar)
      await hidratar()
      // Si nunca vio el onboarding, lo mandamos a /bienvenida después
      // de un instante. Lo hacemos con un timeout para no interferir con
      // la respuesta del login.
      if (localStorage.getItem('finanzas.onboarding.visto') !== '1') {
        setTimeout(() => {
          window.location.hash = '#/bienvenida'
        }, 200)
      }
      return { ok: true, error: null }
    },
    [hidratar],
  )

  const registrar = useCallback<AuthEstado['registrar']>(
    async (email, password, displayName) => {
      const res = await api.post<{ user: PublicUserApi; mensaje: string }>(
        '/auth/register',
        { email, password, displayName },
      )
      if (!res.ok || !res.data)
        return { ok: false, error: res.error, mensaje: undefined }
      // El registro ya NO devuelve token: la cuenta está pendiente de
      // verificar email. Devolvemos ok=true para que la UI muestre
      // "te enviamos un correo" sin loguear todavía.
      return { ok: true, error: null, mensaje: res.data.mensaje }
    },
    [],
  )

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const refrescar = useCallback(async () => {
    await hidratar()
  }, [hidratar])

  const valor: AuthEstado = {
    iniciando,
    autenticado: usuario !== null,
    usuario,
    login,
    registrar,
    cerrarSesion,
    refrescar,
  }

  return <Contexto value={valor}>{children}</Contexto>
}

export function useAuth(): AuthEstado {
  const valor = use(Contexto)
  if (!valor) throw new Error('useAuth necesita estar dentro de ProveedorAuth')
  return valor
}
