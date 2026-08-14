/**
 * Cliente HTTP para la API de NestJS.
 *
 * - `API_URL` viene de `import.meta.env.VITE_API_URL` y se define en `.env`
 *   (no se commitea). Por defecto apunta al backend público.
 * - El JWT vive en localStorage bajo `finanzas.auth.token`; se lee en cada
 *   request vía `Authorization: Bearer <token>`. Si vence (401), el llamador
 *   ve el error y decide (logout, re-login, etc.).
 *
 * Devuelve siempre un objeto con `{ ok, data, error, status }` para que la UI
 * pueda mostrar errores tipados sin try/catch en cada llamada.
 */

const CLAVE_TOKEN = 'finanzas.auth.token'

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.finanzasgz.com.mx'

export function obtenerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}

export function guardarToken(token: string): void {
  localStorage.setItem(CLAVE_TOKEN, token)
}

export function borrarToken(): void {
  localStorage.removeItem(CLAVE_TOKEN)
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

  // 204 No Content
  if (res.status === 204) {
    return { ok: true, status: res.status, data: null, error: null }
  }

  // Intentamos parsear JSON siempre; si no, devolvemos texto.
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
  delete<T = void>(ruta: string) {
    return peticion<T>('DELETE', ruta)
  },
}

export { API_URL }
