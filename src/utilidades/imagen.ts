/**
 * Preparación de la foto de perfil antes de subirla.
 *
 * La foto se guarda como data URL en la fila del usuario, así que el tamaño
 * importa de verdad: una foto de cámara de teléfono son 4 MB, y en base64
 * crecen a 5.3 MB. Recortada al cuadrado y reescalada a 256 px con calidad
 * 0.85 baja a unos 25 KB, que es lo que se ve en un avatar de 96 px.
 *
 * El recorte y el escalado los hace el editor en el momento de "Guardar":
 * 1. `cargarImagenOriginal` decodifica el archivo a un ImageBitmap sin tocarlo
 *    y respeta la orientación EXIF (las fotos de iPhone se ven derechas).
 * 2. `recortarParaFotoPerfil` aplica el pan/zoom que eligió el usuario y
 *    devuelve un data URL cuadrado de 256 px. Estirar la imagen a un cuadrado
 *    sin recortarla le aplastaría la cara a la persona, que es exactamente lo
 *    que uno no quiere de su propia foto de perfil.
 */

export const LADO_SALIDA = 256
const CALIDAD = 0.85

/** Tope de entrada. Por encima de esto ni se intenta decodificar. */
export const MAX_BYTES_ENTRADA = 12 * 1024 * 1024

export type ErrorFoto = 'formato' | 'tamano' | 'lectura'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export interface ResultadoFoto {
  ok: boolean
  dataUrl?: string
  error?: ErrorFoto
}

export interface ResultadoCarga {
  ok: boolean
  bitmap?: ImageBitmap
  ancho?: number
  alto?: number
  error?: ErrorFoto
}

/**
 * Variante "rápida" de la preparación: recorta al cuadrado centrado, sin
 * permitir al usuario elegir el encuadre.
 *
 * Se usa en el registro de cuenta, donde todavía no hay un editor visual:
 * mostrar el editor completo ahí añade fricción a un paso que ya es largo.
 * Si el usuario después quiere ajustar la foto, lo hace desde Ajustes con el
 * editor interactivo.
 */
export async function prepararFotoPerfil(archivo: File): Promise<ResultadoFoto> {
  const carga = await cargarImagenOriginal(archivo)
  if (!carga.ok || !carga.bitmap || carga.ancho === undefined || carga.alto === undefined) {
    return { ok: false, error: carga.error }
  }
  try {
    const dataUrl = recortarParaFotoPerfil(
      carga.bitmap,
      carga.ancho,
      carga.alto,
      { zoom: 1, panX: 0, panY: 0 },
    )
    return { ok: true, dataUrl }
  } catch {
    return { ok: false, error: 'lectura' }
  } finally {
    carga.bitmap.close()
  }
}

/**
 * Decodifica el archivo a un `ImageBitmap` sin recortar ni reescalar. El editor
 * usa este bitmap para mostrar la imagen y para aplicar el recorte final.
 */
export async function cargarImagenOriginal(archivo: File): Promise<ResultadoCarga> {
  if (!TIPOS.includes(archivo.type) && !archivo.type.startsWith('image/')) {
    return { ok: false, error: 'formato' }
  }
  if (archivo.size > MAX_BYTES_ENTRADA) {
    return { ok: false, error: 'tamano' }
  }
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    return { ok: true, bitmap, ancho: bitmap.width, alto: bitmap.height }
  } catch {
    return { ok: false, error: 'lectura' }
  }
}

export interface ParametrosRecorte {
  /** Multiplicador sobre la escala base (1 = "el lado corto llena el círculo"). */
  zoom: number
  /** Traslación desde el centro, en píxeles del viewport del editor. */
  panX: number
  panY: number
}

/**
 * Genera el data URL cuadrado de `LADO_SALIDA` aplicando el recorte del editor.
 *
 * El editor renderiza el bitmap con `scale(escalaBase * zoom)` y
 * `translate(panX, panY)` sobre un viewport cuadrado. Aquí replicamos ese
 * mismo orden de transformaciones para que el recorte sea 1:1 con lo que
 * el usuario vio.
 */
export function recortarParaFotoPerfil(
  bitmap: ImageBitmap,
  anchoOriginal: number,
  altoOriginal: number,
  { zoom, panX, panY }: ParametrosRecorte,
): string {
  // Escala a la que el lado corto del bitmap llena el viewport del editor.
  // El editor la conoce (VIEWPORT / min(W, H)) y la pasamos implícita: si
  // multiplicamos el bitmap por esta escala y luego por `zoom`, obtenemos el
  // mismo tamaño final que vio el usuario.
  const escalaBase = Math.min(LADO_SALIDA, LADO_SALIDA) / Math.min(anchoOriginal, altoOriginal)
  // En la práctica el editor usa un viewport de 256 px; coincide con la salida,
  // pero la fórmula escala aunque cambien las dimensiones del editor.
  const escala = escalaBase * zoom

  const lienzo = document.createElement('canvas')
  lienzo.width = LADO_SALIDA
  lienzo.height = LADO_SALIDA
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto 2D')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Fondo opaco: si la imagen tuviera zonas transparentes (PNG), el JPG de
  // salida queda negro sin esto. El color exacto da igual, no se ve: el
  // avatar circular lo cubre.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LADO_SALIDA, LADO_SALIDA)

  // Mismo orden de transformaciones que el editor:
  // 1. Mover el origen al centro del lienzo.
  // 2. Aplicar la traslación del usuario.
  // 3. Escalar.
  // 4. Dibujar el bitmap con su centro en el origen.
  ctx.translate(LADO_SALIDA / 2 + panX, LADO_SALIDA / 2 + panY)
  ctx.scale(escala, escala)
  ctx.drawImage(bitmap, -anchoOriginal / 2, -altoOriginal / 2)

  return lienzo.toDataURL('image/jpeg', CALIDAD)
}

export const MENSAJE_ERROR_FOTO: Record<ErrorFoto, string> = {
  formato: 'Ese archivo no es una imagen. Usa JPG, PNG o WEBP.',
  tamano: 'La imagen pesa demasiado. Elige una de menos de 12 MB.',
  lectura: 'No pudimos leer esa imagen. Prueba con otra.',
}
