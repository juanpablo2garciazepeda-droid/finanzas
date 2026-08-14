import { clases } from './ui/Basicos'

/**
 * Foto de perfil, con la inicial del nombre como respaldo.
 *
 * El respaldo usa el acento y `--color-sobre-acento` en vez de un color por
 * cuenta: el par acento/sobre-acento es el único del sistema que garantiza
 * 4.5:1 en los dos temas. La versión anterior derivaba el color de un hash del
 * nombre contra clases `bg-rosa` y `bg-morado` que no existen en el tema, así
 * que a una de cada tres cuentas le tocaba un círculo transparente con letra
 * blanca encima del fondo de la página.
 */

const TAMANOS = {
  sm: 'size-7 text-[13px]',
  md: 'size-9 text-[15px]',
  lg: 'size-12 text-[19px]',
  xl: 'size-24 text-[38px]',
} as const

export type TamanoAvatar = keyof typeof TAMANOS

export function Avatar({
  nombre,
  foto,
  tamano = 'md',
  className,
}: {
  nombre: string
  foto?: string | null
  tamano?: TamanoAvatar
  className?: string
}) {
  const inicial = (nombre.trim()[0] ?? '?').toUpperCase()

  if (foto) {
    return (
      <img
        src={foto}
        alt=""
        className={clases(
          'shrink-0 rounded-full object-cover',
          TAMANOS[tamano],
          className,
        )}
      />
    )
  }

  return (
    <span
      className={clases(
        'flex shrink-0 items-center justify-center rounded-full bg-acento font-semibold text-sobre-acento',
        TAMANOS[tamano],
        className,
      )}
      aria-hidden
    >
      {inicial}
    </span>
  )
}
