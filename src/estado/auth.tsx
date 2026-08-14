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
  /**
   * Alta en tres pasos. El correo se confirma ANTES de que exista la cuenta,
   * así que abandonar el registro en la contraseña no deja un usuario a medias.
   *
   * 1. `solicitarCodigo` manda el código de 6 dígitos. Devuelve 409 si ese
   *    correo ya tiene cuenta.
   * 2. `confirmarCodigo` lo canjea por un pase de 30 minutos.
   * 3. `registrar` crea la cuenta con ese pase y abre sesión de una vez: quien
   *    acaba de demostrar que controla el correo y de elegir su contraseña no
   *    tiene por qué teclearla otra vez.
   */
  solicitarCodigo: (
    email: string,
  ) => Promise<{ ok: boolean; status?: number; error: string | null }>
  confirmarCodigo: (
    email: string,
    codigo: string,
  ) => Promise<{ ok: boolean; error: string | null; tokenRegistro?: string }>
  registrar: (datos: {
    email: string
    password: string
    displayName: string
    tokenRegistro: string
    fotoUrl?: string
  }) => Promise<{ ok: boolean; status?: number; error: string | null }>
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
      // `recordar` NO se manda: decide si el token va a localStorage o a
      // sessionStorage, y eso pasa entero en el navegador. El backend valida
      // con `forbidNonWhitelisted`, así que mandárselo hacía fallar el login
      // con "property recordar should not exist" — el campo de más tumbaba
      // la petición completa.
      const res = await api.post<SesionRespuesta>('/auth/login', { email, password })
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

  const solicitarCodigo = useCallback<AuthEstado['solicitarCodigo']>(async (email) => {
    const res = await api.post('/auth/codigo-registro', { email })
    if (!res.ok) return { ok: false, status: res.status, error: res.error }
    return { ok: true, error: null }
  }, [])

  const confirmarCodigo = useCallback<AuthEstado['confirmarCodigo']>(
    async (email, codigo) => {
      const res = await api.post<{ tokenRegistro: string; email: string }>(
        '/auth/confirmar-codigo-registro',
        { email, codigo },
      )
      if (!res.ok || !res.data) return { ok: false, error: res.error }
      return { ok: true, error: null, tokenRegistro: res.data.tokenRegistro }
    },
    [],
  )

  const registrar = useCallback<AuthEstado['registrar']>(
    async ({ email, password, displayName, tokenRegistro, fotoUrl }) => {
      const res = await api.post<SesionRespuesta>('/auth/register', {
        email,
        password,
        displayName,
        tokenRegistro,
        // Solo si hay foto: mandar `undefined` deja la clave fuera del JSON,
        // que es lo que espera el DTO (`@IsOptional`). Mandar cadena vacía
        // fallaría la validación del formato.
        ...(fotoUrl ? { fotoUrl } : {}),
      })
      if (!res.ok || !res.data) {
        return { ok: false, status: res.status, error: res.error }
      }
      // El correo ya se confirmó antes de llegar aquí, así que la cuenta nace
      // con sesión abierta. Persistente: quien acaba de registrarse no espera
      // que cerrar la pestaña le tire la sesión.
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
      solicitarCodigo,
      confirmarCodigo,
      registrar,
      cerrarSesion,
      refrescar,
    }),
    [
      iniciando,
      usuario,
      login,
      solicitarCodigo,
      confirmarCodigo,
      registrar,
      cerrarSesion,
      refrescar,
    ],
  )

  return <Contexto value={valor}>{children}</Contexto>
}

export function useAuth(): AuthEstado {
  const valor = use(Contexto)
  if (!valor) throw new Error('useAuth necesita estar dentro de ProveedorAuth')
  return valor
}
