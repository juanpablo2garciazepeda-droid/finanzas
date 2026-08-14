import { clases } from './ui/Basicos'

/**
 * Identidad de Finanzas GZ.
 *
 * El símbolo es el mismo medidor que preside el tablero: un arco con una
 * porción llena y una aguja. No es decoración — es la pregunta que responde la
 * app ("¿cuánto me queda?") reducida a una forma, y por eso el icono de la
 * pestaña, el de la pantalla de inicio y el del encabezado son el mismo dibujo.
 *
 * Va en SVG y no en una letra dentro de un cuadro: a 16 px un monograma de dos
 * letras se convierte en una mancha, y el arco sigue siendo legible.
 */

export function MarcaGZ({
  tamano = 32,
  className,
}: {
  tamano?: number
  className?: string
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      className={clases('shrink-0', className)}
      role="img"
      aria-label="Finanzas GZ"
    >
      <rect width="64" height="64" rx="14.5" fill="var(--color-acento)" />
      {/* Recorrido completo del medidor, apagado: el techo contra el que se lee
          la parte llena. Sin él, el arco lleno no tiene escala. */}
      <path
        d="M14 41 A18 18 0 0 1 50 41"
        fill="none"
        stroke="var(--color-sobre-acento)"
        strokeOpacity="0.32"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Porción disponible. */}
      <path
        d="M14 41 A18 18 0 0 1 27.4 23.6"
        fill="none"
        stroke="var(--color-sobre-acento)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="41" r="3.6" fill="var(--color-sobre-acento)" />
    </svg>
  )
}

/**
 * Símbolo + nombre. `compacto` esconde el texto en pantallas angostas, donde
 * el encabezado necesita el ancho para el selector de mes.
 */
export function Logotipo({
  tamano = 32,
  compacto,
  className,
  tamanoTexto = 17,
}: {
  tamano?: number
  compacto?: boolean
  className?: string
  tamanoTexto?: number
}) {
  return (
    <span className={clases('flex shrink-0 items-center gap-2.5', className)}>
      <MarcaGZ tamano={tamano} />
      <span
        className={clases(
          'font-display font-semibold whitespace-nowrap text-tinta',
          compacto && 'hidden sm:inline',
        )}
        style={{ fontSize: tamanoTexto, letterSpacing: '-0.03em' }}
      >
        Finanzas <span className="text-acento">GZ</span>
      </span>
    </span>
  )
}
