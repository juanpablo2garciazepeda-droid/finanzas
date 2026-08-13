import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import type { NivelAlerta } from '@/dominio/tipos'

export function clases(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────

interface TarjetaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Tarjeta({ className, children, ...props }: TarjetaProps) {
  return (
    <div
      className={clases('rounded-tarjeta bg-superficie p-4 shadow-tarjeta sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <h2 className="font-display text-[19px] font-semibold text-tinta">{children}</h2>
      {accion}
    </div>
  )
}

// ─── Botón ───────────────────────────────────────────────────────────────────

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-acento text-sobre-acento hover:bg-acento-hondo active:scale-[0.98]',
  // El borde no es decorativo: `elevada` coincide con el fondo de la página en
  // tema claro, así que sin él el botón desaparece fuera de una tarjeta.
  secundario: 'border border-borde bg-elevada text-acento hover:bg-hundida active:scale-[0.98]',
  fantasma: 'text-acento hover:bg-elevada',
  peligro: 'bg-rojo/8 text-rojo hover:bg-rojo/14',
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  ancho?: boolean
}

export function Boton({ variante = 'primario', ancho, className, children, ...props }: BotonProps) {
  return (
    <button
      className={clases(
        // Píldora completa y 11px/21px de relleno, como los botones de Apple.
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-[11px] text-[15px] font-normal transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-35',
        VARIANTES[variante],
        ancho && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Campos de formulario ────────────────────────────────────────────────────

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
  htmlFor,
}: {
  etiqueta: string
  ayuda?: string
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-[13px] font-medium text-suave">{etiqueta}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-rojo">{error}</span>
      ) : ayuda ? (
        <span className="mt-1.5 block text-xs text-tenue">{ayuda}</span>
      ) : null}
    </label>
  )
}

const BASE_ENTRADA =
  'w-full rounded-campo border border-borde bg-superficie px-3.5 py-2.5 text-[15px] text-tinta placeholder:text-tenue transition-shadow focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none'

export function Entrada({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={clases(BASE_ENTRADA, className)} {...props} />
}

export function Selector({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={clases(BASE_ENTRADA, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tenue"
        aria-hidden
      />
    </div>
  )
}

// ─── Barra de progreso ───────────────────────────────────────────────────────

const COLOR_NIVEL: Record<NivelAlerta, string> = {
  verde: 'bg-verde',
  ambar: 'bg-ambar',
  rojo: 'bg-rojo',
}

export function Barra({
  fraccion,
  nivel = 'verde',
  color,
  alto = 'h-2',
  etiqueta,
}: {
  fraccion: number
  nivel?: NivelAlerta
  /** Color explícito (el de la categoría). Gana sobre el nivel. */
  color?: string
  alto?: string
  etiqueta?: string
}) {
  const ancho = Math.min(100, Math.max(0, fraccion * 100))
  const sobregiro = fraccion > 1
  return (
    <div
      className={clases('w-full overflow-hidden rounded-full bg-hundida', alto)}
      role="progressbar"
      aria-valuenow={Math.round(fraccion * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
    >
      <div
        className={clases(
          'h-full rounded-full transition-all duration-500 ease-out',
          !color && COLOR_NIVEL[nivel],
          sobregiro && 'animar-pulso',
        )}
        style={{ width: `${ancho}%`, backgroundColor: sobregiro ? undefined : color }}
      />
    </div>
  )
}

// ─── Insignias ───────────────────────────────────────────────────────────────

const TONO_NIVEL: Record<NivelAlerta, string> = {
  verde: 'bg-verde/10 text-verde',
  ambar: 'bg-ambar/10 text-ambar',
  rojo: 'bg-rojo/10 text-rojo',
}

export function Insignia({
  nivel,
  neutra,
  children,
}: {
  nivel?: NivelAlerta
  neutra?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={clases(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        neutra || !nivel ? 'bg-elevada text-suave' : TONO_NIVEL[nivel],
      )}
    >
      {children}
    </span>
  )
}

/** Punto de color del semáforo. */
export function Punto({ nivel, className }: { nivel: NivelAlerta; className?: string }) {
  return (
    <span
      className={clases('inline-block size-2 shrink-0 rounded-full', COLOR_NIVEL[nivel], className)}
      aria-hidden
    />
  )
}

// ─── Estados vacíos ──────────────────────────────────────────────────────────

export function Vacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-superficie px-6 py-12 text-center shadow-tarjeta">
      <h3 className="font-display text-base font-medium text-tinta">{titulo}</h3>
      <p className="max-w-xs text-sm text-suave">{descripcion}</p>
      {accion}
    </div>
  )
}

/** Cifra grande con su etiqueta. La unidad visual básica del tablero. */
export function Cifra({
  etiqueta,
  valor,
  detalle,
  tono = 'text-tinta',
  tamano = 'cifra-xl',
}: {
  etiqueta: string
  valor: string
  detalle?: ReactNode
  tono?: string
  /** Usa las clases fluidas `cifra-xl` / `cifra-lg`: un tamaño fijo desborda la
   *  celda en pantallas de 320 px. */
  tamano?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-suave">{etiqueta}</p>
      <p className={clases('cifras mt-1 font-semibold', tamano, tono)}>{valor}</p>
      {detalle && <div className="mt-1 text-xs text-tenue">{detalle}</div>}
    </div>
  )
}
