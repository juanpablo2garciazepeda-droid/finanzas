/**
 * Preparación de la foto de perfil antes de subirla.
 *
 * La foto se guarda como data URL en la fila del usuario, así que el tamaño
 * importa de verdad: una foto de cámara de teléfono son 4 MB, y en base64
 * crecen a 5.3 MB. Recortada al cuadrado y reescalada a 256 px con calidad
 * 0.85 baja a unos 25 KB, que es lo que se ve en un avatar de 96 px.
 *
 * El recorte es centrado y no deformante: estirar una foto vertical a un
 * cuadrado le aplasta la cara a la persona, que es exactamente lo que uno no
 * quiere de su propia foto de perfil.
 */

const LADO = 256
const CALIDAD = 0.85

/** Tope de entrada. Por encima de esto ni se intenta decodificar. */
export const MAX_BYTES_ENTRADA = 12 * 1024 * 1024

export type ErrorFoto = 'formato' | 'tamano' | 'lectura'

export interface ResultadoFoto {
  ok: boolean
  dataUrl?: string
  error?: ErrorFoto
}

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function prepararFotoPerfil(archivo: File): Promise<ResultadoFoto> {
  if (!TIPOS.includes(archivo.type) && !archivo.type.startsWith('image/')) {
    return { ok: false, error: 'formato' }
  }
  if (archivo.size > MAX_BYTES_ENTRADA) {
    return { ok: false, error: 'tamano' }
  }

  let bitmap: ImageBitmap
  try {
    // `createImageBitmap` decodifica fuera del hilo principal y entiende
    // la orientación EXIF, que es lo que evita que las fotos verticales de
    // iPhone salgan acostadas.
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    return { ok: false, error: 'lectura' }
  }

  try {
    const lado = Math.min(bitmap.width, bitmap.height)
    const x = (bitmap.width - lado) / 2
    const y = (bitmap.height - lado) / 2

    const lienzo = document.createElement('canvas')
    lienzo.width = LADO
    lienzo.height = LADO
    const ctx = lienzo.getContext('2d')
    if (!ctx) return { ok: false, error: 'lectura' }

    // Sin esto, reducir una foto grande de golpe produce escalones en los
    // bordes: el navegador muestrea sin promediar.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO, LADO)

    return { ok: true, dataUrl: lienzo.toDataURL('image/jpeg', CALIDAD) }
  } catch {
    return { ok: false, error: 'lectura' }
  } finally {
    bitmap.close()
  }
}

export const MENSAJE_ERROR_FOTO: Record<ErrorFoto, string> = {
  formato: 'Ese archivo no es una imagen. Usa JPG, PNG o WEBP.',
  tamano: 'La imagen pesa demasiado. Elige una de menos de 12 MB.',
  lectura: 'No pudimos leer esa imagen. Prueba con otra.',
}
