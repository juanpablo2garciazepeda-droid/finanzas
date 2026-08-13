/**
 * Bloqueo con PIN.
 *
 * Qué es: un candado de pantalla para el teléfono, para que quien lo tome
 * prestado no vea tus finanzas.
 *
 * Qué NO es: autenticación. No hay servidor contra el que validar y los datos
 * siguen en IndexedDB sin cifrar; alguien con acceso al dispositivo y ganas
 * puede leerlos desde las herramientas del navegador. La pantalla de ajustes lo
 * dice con estas mismas palabras, porque prometer seguridad que no existe es
 * peor que no ofrecerla.
 *
 * El PIN se guarda como hash SHA-256 con sal aleatoria: aunque alguien abra el
 * almacenamiento, no ve el número.
 */

const CLAVE_HASH = 'finanzas.bloqueo.hash'
const CLAVE_SAL = 'finanzas.bloqueo.sal'
const CLAVE_SESION = 'finanzas.bloqueo.abierto'

function aHex(datos: ArrayBuffer): string {
  return [...new Uint8Array(datos)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function resumen(pin: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${pin}`)
  return aHex(await crypto.subtle.digest('SHA-256', datos))
}

export function hayPin(): boolean {
  return localStorage.getItem(CLAVE_HASH) !== null
}

export async function fijarPin(pin: string): Promise<void> {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  localStorage.setItem(CLAVE_SAL, sal)
  localStorage.setItem(CLAVE_HASH, await resumen(pin, sal))
  abrirSesion()
}

export function quitarPin(): void {
  localStorage.removeItem(CLAVE_HASH)
  localStorage.removeItem(CLAVE_SAL)
  sessionStorage.removeItem(CLAVE_SESION)
}

export async function pinCorrecto(pin: string): Promise<boolean> {
  const guardado = localStorage.getItem(CLAVE_HASH)
  const sal = localStorage.getItem(CLAVE_SAL)
  if (!guardado || !sal) return true
  return (await resumen(pin, sal)) === guardado
}

/** La sesión vive en `sessionStorage`: al cerrar la pestaña vuelve a pedirlo. */
export function abrirSesion(): void {
  sessionStorage.setItem(CLAVE_SESION, '1')
}

export function sesionAbierta(): boolean {
  return sessionStorage.getItem(CLAVE_SESION) === '1'
}

export function cerrarSesion(): void {
  sessionStorage.removeItem(CLAVE_SESION)
}

const CLAVE_OCULTA = 'finanzas.bloqueo.oculta'
/** Minutos en segundo plano tras los que se vuelve a pedir el PIN. */
const TOLERANCIA_MINUTOS = 2

/**
 * Vuelve a echar el candado cuando la app pasa un rato en segundo plano. En el
 * teléfono la pestaña no se cierra al cambiar de app, así que sin esto el PIN
 * se pediría una sola vez al día.
 */
export function vigilarSegundoPlano(alBloquear: () => void): () => void {
  const alCambiar = () => {
    if (document.hidden) {
      sessionStorage.setItem(CLAVE_OCULTA, String(Date.now()))
      return
    }
    const desde = Number(sessionStorage.getItem(CLAVE_OCULTA) ?? 0)
    if (!desde) return
    sessionStorage.removeItem(CLAVE_OCULTA)
    if (Date.now() - desde > TOLERANCIA_MINUTOS * 60_000 && hayPin()) {
      cerrarSesion()
      alBloquear()
    }
  }
  document.addEventListener('visibilitychange', alCambiar)
  return () => document.removeEventListener('visibilitychange', alCambiar)
}
