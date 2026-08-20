import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ImageDown, Loader2, RotateCcw, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton, clases } from '@/componentes/ui/Basicos'
import {
  cargarImagenOriginal,
  recortarParaFotoPerfil,
  MENSAJE_ERROR_FOTO,
} from '@/utilidades/imagen'
import { useT } from '@/estado/i18n'

/**
 * Editor de foto de perfil con preview interactivo.
 *
 * El usuario puede arrastrar la imagen para encuadrar y un slider de zoom
 * para acercarse. Solo cuando confirma, el recorte final se aplica y se
 * sube al servidor: hasta entonces, el bitmap vive en el navegador.
 *
 * El recorte final se calcula replicando las mismas transformaciones CSS
 * (translate + scale) en un canvas, así que lo que se ve es 1:1 con lo
 * que se va a guardar.
 */

// Tamaño visible del editor y de la imagen final. Si en el futuro se quiere
// una vista previa más grande, hay que tocar también `recortarParaFotoPerfil`
// para que la escala siga siendo 1:1.
const VIEWPORT = 256
// Rango de zoom. 1 = el lado corto de la imagen llena el viewport, sin más.
// 3 = tres veces más grande, suficiente para fotos en grupo.
const ZOOM_MIN = 1
const ZOOM_MAX = 3

export function EditorFotoPerfil({
  archivo,
  nombre: _nombre,
  onCerrar,
  onGuardado,
}: {
  /** Imagen recién elegida. `null` significa que todavía no hay selección. */
  archivo: File | null
  /** Para mostrar la inicial al lado de la previsualización. */
  nombre: string
  onCerrar: () => void
  /** Se llama con el data URL ya recortado. Ya validado y cuadrado. */
  onGuardado: (dataUrl: string) => void | Promise<void>
}) {
  const t = useT()
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [tamano, setTamano] = useState<{ ancho: number; alto: number } | null>(null)
  // El File del que viene el bitmap actual. Lo guardamos aparte del `archivo`
  // prop porque el modal tiene su propio picker: si el usuario elige otra
  // imagen desde aquí, la prop `archivo` no se entera, pero nosotros sí
  // necesitamos el File para hacer el blob URL que muestra la imagen.
  const [archivoActual, setArchivoActual] = useState<File | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const arrastreRef = useRef<{
    startX: number
    startY: number
    posInicial: { x: number; y: number }
  } | null>(null)

  // Carga el bitmap cuando llega un archivo nuevo. Si el padre abre el modal
  // con `archivo = X`, se carga X. Si el usuario elige otra desde el modal,
  // `alElegirArchivo` actualiza el estado directamente.
  useEffect(() => {
    if (!archivo) {
      setBitmap(null)
      setTamano(null)
      setArchivoActual(null)
      setError(null)
      setZoom(1)
      setPos({ x: 0, y: 0 })
      return
    }
    if (archivo === archivoActual) return // ya cargado
    void cargarDeArchivo(archivo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo])

  async function cargarDeArchivo(a: File) {
    setProcesando(true)
    setError(null)
    const res = await cargarImagenOriginal(a)
    setProcesando(false)
    if (!res.ok || !res.bitmap || res.ancho === undefined || res.alto === undefined) {
      setError(MENSAJE_ERROR_FOTO[res.error ?? 'lectura'])
      return
    }
    // Cerramos el bitmap anterior si lo había, para no acumular memoria.
    setBitmap((anterior) => {
      if (anterior && anterior !== res.bitmap) anterior.close()
      return res.bitmap ?? null
    })
    setTamano({ ancho: res.ancho, alto: res.alto })
    setArchivoActual(a)
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }

  // Cerrar el bitmap al desmontar: si cancelas, no queremos que se quede en
  // memoria hasta que recoja el garbage collector.
  useEffect(() => {
    return () => {
      bitmap?.close()
    }
  }, [bitmap])

  // El `<img>` no acepta un ImageBitmap. Usamos el File original para
  // sacar un blob URL: es un BlobPart válido y refleja la imagen tal
  // como la decodificó el navegador.
  const [srcImagen, setSrcImagen] = useState<string | null>(null)
  useEffect(() => {
    if (!archivoActual) {
      setSrcImagen(null)
      return
    }
    const url = URL.createObjectURL(archivoActual)
    setSrcImagen(url)
    return () => URL.revokeObjectURL(url)
  }, [archivoActual])

  // Tamaño de la imagen renderizada con el zoom actual. Con `zoom = 1` el
  // lado corto llena el viewport, y crece linealmente con el zoom. Usamos
  // `Math.max` para que la escala sea la que hace el lado corto llegar
  // exactamente a VIEWPORT, dejando el lado largo sobresalir para hacer pan.
  const { anchoRender, altoRender, maxOffsetX, maxOffsetY } = useMemo(() => {
    if (!tamano) {
      return { anchoRender: 0, altoRender: 0, maxOffsetX: 0, maxOffsetY: 0 }
    }
    const escala =
      Math.max(VIEWPORT / tamano.ancho, VIEWPORT / tamano.alto) * zoom
    const anchoRender = tamano.ancho * escala
    const altoRender = tamano.alto * escala
    const maxOffsetX = Math.max(0, (anchoRender - VIEWPORT) / 2)
    const maxOffsetY = Math.max(0, (altoRender - VIEWPORT) / 2)
    return { anchoRender, altoRender, maxOffsetX, maxOffsetY }
  }, [tamano, zoom])

  // Al cambiar el zoom, recentramos si la imagen ya no se puede mover tanto
  // como el usuario la tenía. Si no se hace esto, un zoom out puede dejar
  // la imagen descentrada con respecto a los nuevos límites.
  useEffect(() => {
    setPos((p) => ({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, p.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, p.y)),
    }))
  }, [maxOffsetX, maxOffsetY])

  function clampPos(x: number, y: number) {
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, y)),
    }
  }

  // ── Drag para mover la imagen ────────────────────────────────────────
  function alIniciarDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!bitmap) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    arrastreRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posInicial: pos,
    }
  }
  function alMoverDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const ref = arrastreRef.current
    if (!ref) return
    const dx = e.clientX - ref.startX
    const dy = e.clientY - ref.startY
    setPos(clampPos(ref.posInicial.x + dx, ref.posInicial.y + dy))
  }
  function alTerminarDrag(e: ReactPointerEvent<HTMLDivElement>) {
    arrastreRef.current = null
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // Si el navegador ya soltó el capture (pointer cancelado), no importa.
    }
  }

  function alSoltarArchivo(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault()
    setArrastrandoArchivo(false)
    const a = evento.dataTransfer.files?.[0]
    if (a) void cargarDeArchivo(a)
  }

  function abrirPicker() {
    entrada.current?.click()
  }

  function alElegirArchivo(archivos: FileList | null) {
    const a = archivos?.[0]
    if (!a) return
    void cargarDeArchivo(a)
  }

  function recentrar() {
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }

  function ajustarZoom(nuevo: number) {
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nuevo)))
  }

  async function guardar() {
    if (!bitmap || !tamano) return
    setGuardando(true)
    try {
      const dataUrl = recortarParaFotoPerfil(
        bitmap,
        tamano.ancho,
        tamano.alto,
        { zoom, panX: pos.x, panY: pos.y },
      )
      await onGuardado(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aviso.no_foto'))
    } finally {
      setGuardando(false)
    }
  }

  const hayImagen = bitmap !== null && srcImagen !== null

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t('ajustes.previsualizar_foto')}>
      <div className="grid gap-5 sm:grid-cols-[256px_1fr] sm:items-start">
        <div className="flex flex-col items-center gap-3">
          <div
            onPointerDown={alIniciarDrag}
            onPointerMove={alMoverDrag}
            onPointerUp={alTerminarDrag}
            onPointerCancel={alTerminarDrag}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrandoArchivo(true)
            }}
            onDragLeave={() => setArrastrandoArchivo(false)}
            onDrop={alSoltarArchivo}
            className={clases(
              'relative shrink-0 overflow-hidden rounded-full border-2 border-dashed bg-elevada transition-colors',
              'select-none',
              arrastrandoArchivo ? 'border-acento bg-acento/10' : 'border-borde',
              // `touch-none` deja que el browser no robe el evento para scroll
              // al arrastrar dentro del círculo.
              hayImagen ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer',
            )}
            style={{ width: VIEWPORT, height: VIEWPORT }}
            role="img"
            aria-label={t('ajustes.previsualizar_foto')}
          >
            {procesando ? (
              <Loader2 className="absolute inset-0 m-auto size-10 animate-spin text-tenue" aria-hidden />
            ) : hayImagen ? (
              <img
                src={srcImagen}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: anchoRender,
                  height: altoRender,
                  left: VIEWPORT / 2 - anchoRender / 2 + pos.x,
                  top: VIEWPORT / 2 - altoRender / 2 + pos.y,
                }}
              />
            ) : (
              <ImageDown className="absolute inset-0 m-auto size-12 text-tenue" aria-hidden />
            )}
          </div>

          {hayImagen && (
            <div className="flex w-full flex-col items-center gap-2">
              <div className="flex items-center gap-1">
                <Boton
                  variante="fantasma"
                  onClick={() => ajustarZoom(zoom - 0.25)}
                  aria-label={t('ajustes.zoom_menos')}
                  className="px-2 py-1"
                >
                  <ZoomOut className="size-4" aria-hidden />
                </Boton>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => ajustarZoom(Number(e.target.value))}
                  aria-label={t('ajustes.zoom')}
                  className="h-2 flex-1 accent-acento"
                />
                <Boton
                  variante="fantasma"
                  onClick={() => ajustarZoom(zoom + 0.25)}
                  aria-label={t('ajustes.zoom_mas')}
                  className="px-2 py-1"
                >
                  <ZoomIn className="size-4" aria-hidden />
                </Boton>
              </div>
              <Boton variante="fantasma" onClick={recentrar} className="px-3 py-1 text-[12px]">
                <RotateCcw className="size-3.5" aria-hidden />
                {t('ajustes.recentrar')}
              </Boton>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-tinta">{t('ajustes.foto_ajustar')}</p>
          <p className="text-xs text-tenue">{t('ajustes.foto_recomendacion')}</p>

          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              alElegirArchivo(e.target.files)
              e.target.value = ''
            }}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Boton variante="fantasma" onClick={abrirPicker}>
              <Upload className="size-4" aria-hidden />
              {t('ajustes.elegir_otra')}
            </Boton>
          </div>

          {error && <p className="text-xs text-rojo">{error}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
          <X className="size-4" aria-hidden />
          {t('comun.cancelar')}
        </Boton>
        <Boton onClick={() => void guardar()} disabled={!hayImagen || guardando || procesando}>
          {guardando ? t('comun.guardando') : t('ajustes.confirmar_foto')}
        </Boton>
      </div>
    </Modal>
  )
}
