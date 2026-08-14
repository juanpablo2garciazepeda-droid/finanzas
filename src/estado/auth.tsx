import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
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
  /** Data URL de la foto de perfil, o `null` si no puso ninguna. */
  fotoUrl: string | null
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
    fotoUrl?: string,
  ) => Promise<{
    ok: boolean
    status?: number
    error: string | null
    mensaje?: string
    emailEnviadoA?: string
    emailOk?: boolean
  }>
  /**
   * Canjea el código de 6 dígitos del correo. Si es correcto, el backend
   * devuelve sesión iniciada y aquí queda guardada: quien acaba de demostrar
   * que controla el correo no tiene por qué volver a teclear la contraseña
   * que escribió hace un minuto.
   */
  verificarCodigo: (
    email: string,
    codigo: string,
  ) => Promise<{ ok: boolean; error: string | null }>
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
  /** Data URL de la foto de perfil, o `null` si no puso ninguna. */
  fotoUrl: string | null
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
        fotoUrl: me.data.fotoUrl ?? null,
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
    async (email, password, displayName, fotoUrl) => {
      const res = await api.post<{
        cuentaCreada: true
        user: PublicUserApi
        mensaje: string
        emailEnviadoA: string
        emailOk: boolean
      }>('/auth/register', {
        email,
        password,
        displayName,
        // Solo si hay foto: mandar `undefined` deja la clave fuera del JSON,
        // que es lo que espera el DTO (`@IsOptional`). Mandar cadena vacía
        // fallaría la validación del formato.
        ...(fotoUrl ? { fotoUrl } : {}),
      })
      if (!res.ok || !res.data) {
        return { ok: false, status: res.status, error: res.error, mensaje: undefined }
      }
      // El registro NO devuelve token: la cuenta queda pendiente de verificar
      // el correo. La sesión llega al canjear el código.
      return {
        ok: true,
        error: null,
        mensaje: res.data.mensaje,
        emailEnviadoA: res.data.emailEnviadoA,
        emailOk: res.data.emailOk,
      }
    },
    [],
  )

  const verificarCodigo = useCallback<AuthEstado['verificarCodigo']>(
    async (email, codigo) => {
      const res = await api.post<SesionRespuesta>('/auth/verificar-codigo', {
        email,
        codigo,
      })
      if (!res.ok || !res.data) return { ok: false, error: res.error }
      // Cuenta recién creada: la sesión persiste. Quien se acaba de registrar
      // no espera que cerrar la pestaña le tire la sesión.
      guardarToken(res.data.accessToken, true)
      await hidratar()
      return { ok: true, error: null }
    },
    [hidratar],
  )

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const refrescar = useCallback(async () => {
    await hidratar()
  }, [hidratar])

  // Memoizado a propósito: sin esto el objeto es nuevo en cada render y
  // cualquier `useEffect` que dependa de `auth` se vuelve a disparar en bucle.
  // Le pasaba a VerificarEmail, que reenviaba el token en cada vuelta.
  const valor = useMemo<AuthEstado>(
    () => ({
      iniciando,
      autenticado: usuario !== null,
      usuario,
      login,
      registrar,
      verificarCodigo,
      cerrarSesion,
      refrescar,
    }),
    [iniciando, usuario, login, registrar, verificarCodigo, cerrarSesion, refrescar],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useAuth(): AuthEstado {
  const valor = use(Contexto)
  if (!valor) throw new Error('useAuth necesita estar dentro de ProveedorAuth')
  return valor
}
