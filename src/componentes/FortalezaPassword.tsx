import { Check } from 'lucide-react'
import { useT } from '@/estado/i18n'
import { clases } from './ui/Basicos'

/**
 * Medidor de fortaleza de contraseña, compartido por el registro y el
 * restablecimiento.
 *
 * Vivía copiado en tres archivos con criterios ligeramente distintos: una
 * versión etiquetaba cinco niveles sobre una escala de cuatro barras, así que
 * "excelente" no se alcanzaba nunca. Que la misma contraseña se califique
 * distinto según la pantalla es peor que no calificarla.
 *
 * El criterio de `cumple` es exactamente el que aplica el backend en
 * `passwordCumplePolitica`. Si divergen, el usuario ve verde y luego un 400.
 *
 * El componente se mantiene visible mientras el usuario está escribiendo, no
 * desaparece al cumplir la política: ver el checklist completo con todos los
 * checks en verde confirma que está bien, y al seguir editando se ve qué
 * requisito se rompería.
 */

export interface Fortaleza {
  /** 1 a 4. Cero significa "todavía no escribe nada". */
  nivel: 0 | 1 | 2 | 3 | 4
  /** Si pasa la política mínima. Es lo único que bloquea el envío. */
  cumple: boolean
  mensaje: string
  /** Detalle por requisito, útil para pintar el checklist. */
  requisitos: {
    longitud: boolean
    mayuscula: boolean
    minuscula: boolean
    numero: boolean
  }
}

export function fortalezaPassword(p: string): Fortaleza {
  if (p.length === 0) {
    return {
      nivel: 0,
      cumple: false,
      mensaje: '',
      requisitos: { longitud: false, mayuscula: false, minuscula: false, numero: false },
    }
  }

  const requisitos = {
    longitud: p.length >= 8,
    mayuscula: /[A-Z]/.test(p),
    minuscula: /[a-z]/.test(p),
    numero: /[0-9]/.test(p),
  }
  const cumple =
    requisitos.longitud && requisitos.mayuscula && requisitos.minuscula && requisitos.numero

  let puntos = 0
  if (p.length >= 8) puntos++
  if (p.length >= 12) puntos++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) puntos++
  if (/[0-9]/.test(p)) puntos++
  if (/[^A-Za-z0-9]/.test(p)) puntos++

  const nivel = Math.min(4, Math.max(1, puntos)) as 1 | 2 | 3 | 4

  return {
    nivel,
    cumple,
    // El mensaje dice qué falta, no solo que algo falta: "usa una mayúscula"
    // es accionable, "contraseña débil" obliga a adivinar.
    mensaje: cumple ? 'fortalezas.cumple' : queFalta(p, requisitos),
    requisitos,
  }
}

function queFalta(
  p: string,
  r: { longitud: boolean; mayuscula: boolean; minuscula: boolean; numero: boolean },
): string {
  const faltantes: string[] = []
  if (!r.longitud) faltantes.push('8 caracteres')
  if (!r.mayuscula) faltantes.push('una mayúscula')
  if (!r.minuscula) faltantes.push('una minúscula')
  if (!r.numero) faltantes.push('un número')
  // fallback de seguridad por si la lista quedó vacía pero `cumple` es false
  if (faltantes.length === 0 && p.length > 0) return 'fortalezas.cumple'

  if (faltantes.length === 1) return `Te falta ${faltantes[0]}.`
  const ultimo = faltantes.pop()
  return `Te faltan ${faltantes.join(', ')} y ${ultimo}.`
}

const ETIQUETAS = ['', 'débil', 'regular', 'bien', 'fuerte'] as const
const COLORES = ['', 'bg-rojo', 'bg-ambar', 'bg-ambar', 'bg-verde'] as const

export function MedidorFortaleza({ fuerza }: { fuerza: Fortaleza }) {
  const t = useT()
  // Mientras el campo esté vacío, no mostramos nada. Una vez que el usuario
  // empieza a escribir, el checklist se queda visible — incluso cuando ya
  // cumple todo, para que vea confirmado el cumplimiento y, si sigue
  // editando, qué requisito se rompería.
  if (fuerza.nivel === 0) return null

  const mensajeTraducido = fuerza.mensaje.startsWith('fortalezas.')
    ? t(fuerza.mensaje)
    : fuerza.mensaje

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clases(
              'h-1 flex-1 rounded-full transition-colors',
              i <= fuerza.nivel ? COLORES[fuerza.nivel] : 'bg-hundida',
            )}
            aria-hidden
          />
        ))}
      </div>
      <ul className="space-y-1 text-[12px] leading-snug">
        <Requisito cumplido={fuerza.requisitos.longitud}>
          {t('fortalezas.longitud')}
        </Requisito>
        <Requisito cumplido={fuerza.requisitos.mayuscula}>
          {t('fortalezas.mayuscula')}
        </Requisito>
        <Requisito cumplido={fuerza.requisitos.minuscula}>
          {t('fortalezas.minuscula')}
        </Requisito>
        <Requisito cumplido={fuerza.requisitos.numero}>
          {t('fortalezas.numero')}
        </Requisito>
      </ul>
      <p className="flex items-center gap-1.5 text-[12px] leading-snug text-tenue">
        <span
          className={clases(
            'inline-block size-1.5 rounded-full',
            fuerza.cumple ? 'bg-verde' : 'bg-ambar',
          )}
          aria-hidden
        />
        <span>
          {ETIQUETAS[fuerza.nivel]} · {mensajeTraducido}
        </span>
      </p>
    </div>
  )
}

function Requisito({
  cumplido,
  children,
}: {
  cumplido: boolean
  children: React.ReactNode
}) {
  return (
    <li
      className={clases(
        'flex items-center gap-1.5 transition-colors',
        cumplido ? 'text-verde' : 'text-tenue',
      )}
    >
      <Check
        className={clases(
          'size-3.5 shrink-0 transition-opacity',
          cumplido ? 'opacity-100' : 'opacity-30',
        )}
        strokeWidth={cumplido ? 2.5 : 1.75}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  )
}
