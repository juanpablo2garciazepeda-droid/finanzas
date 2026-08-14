/**
 * Cliente HTTP para la API de NestJS.
 *
 * - `API_URL` viene de `import.meta.env.VITE_API_URL`; por defecto el backend
 *   público en `https://api.finanzasgz.com.mx`.
 * - El JWT vive en localStorage (persistente entre sesiones) o en
 *   sessionStorage (se borra al cerrar el navegador), según "recordarme".
 *   Se lee de los dos con prioridad a sessionStorage, así un usuario que
 *   entra como invitado no le "contamina" el token persistente.
 * - Si el backend devuelve 401, además de propagar el error, limpiamos
 *   el token: la próxima request no llevará Authorization y la UI verá al
 *   usuario como deslogueado.
 */

const CLAVE_TOKEN_LOCAL = 'finanzas.auth.token'
const CLAVE_TOKEN_SESION = 'finanzas.auth.token.sesion'

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.finanzasgz.com.mx'

export function obtenerToken(): string | null {
  return (
    sessionStorage.getItem(CLAVE_TOKEN_SESION) ??
    localStorage.getItem(CLAVE_TOKEN_LOCAL)
  )
}

export function guardarToken(token: string, recordar: boolean): void {
  if (recordar) {
    localStorage.setItem(CLAVE_TOKEN_LOCAL, token)
    sessionStorage.removeItem(CLAVE_TOKEN_SESION)
  } else {
    sessionStorage.setItem(CLAVE_TOKEN_SESION, token)
    localStorage.removeItem(CLAVE_TOKEN_LOCAL)
  }
}

export function borrarToken(): void {
  localStorage.removeItem(CLAVE_TOKEN_LOCAL)
  sessionStorage.removeItem(CLAVE_TOKEN_SESION)
}

export interface Respuesta<T> {
  ok: boolean
  status: number
  data: T | null
  /** Mensaje de error legible, ya sea del backend (`message`) o de red. */
  error: string | null
}

interface ErrorApi {
  message?: string | string[]
  statusCode?: number
  error?: string
}

async function peticion<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta<T>> {
  const token = obtenerToken()
  const encabezados: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) encabezados.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  }

  if (res.status === 204) {
    return { ok: true, status: res.status, data: null, error: null }
  }

  const texto = await res.text()
  let parsed: unknown = null
  if (texto) {
    try {
      parsed = JSON.parse(texto)
    } catch {
      parsed = texto
    }
  }

  if (!res.ok) {
    // 401 → sesión inválida o revocada. Limpiamos token para que la UI
    // muestre el login sin que la próxima request cargue basura.
    if (res.status === 401) {
      borrarToken()
    }
    // 429 → rate limit. Mensaje amistoso.
    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        data: null,
        error: 'Demasiados intentos. Espera un momento y vuelve a intentar.',
      }
    }
    const errBody = parsed as ErrorApi | null
    const mensaje = Array.isArray(errBody?.message)
      ? errBody!.message.join(', ')
      : (errBody?.message ?? `HTTP ${res.status}`)
    return { ok: false, status: res.status, data: null, error: mensaje }
  }

  return { ok: true, status: res.status, data: parsed as T, error: null }
}

export const api = {
  get<T>(ruta: string) {
    return peticion<T>('GET', ruta)
  },
  post<T>(ruta: string, cuerpo?: unknown) {
    return peticion<T>('POST', ruta, cuerpo)
  },
  patch<T>(ruta: string, cuerpo?: unknown) {
    return peticion<T>('PATCH', ruta, cuerpo)
  },
  delete<T = void>(ruta: string, cuerpo?: unknown) {
    return peticion<T>('DELETE', ruta, cuerpo)
  },
}

export { API_URL }
