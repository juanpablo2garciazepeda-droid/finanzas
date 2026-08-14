import { Check, X } from 'lucide-react'
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
 */

export interface Fortaleza {
  /** 1 a 4. Cero significa "todavía no escribe nada". */
  nivel: 0 | 1 | 2 | 3 | 4
  /** Si pasa la política mínima. Es lo único que bloquea el envío. */
  cumple: boolean
  mensaje: string
}

export function fortalezaPassword(p: string): Fortaleza {
  if (p.length === 0) return { nivel: 0, cumple: false, mensaje: '' }

  let puntos = 0
  if (p.length >= 8) puntos++
  if (p.length >= 12) puntos++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) puntos++
  if (/[0-9]/.test(p)) puntos++
  if (/[^A-Za-z0-9]/.test(p)) puntos++

  const nivel = Math.min(4, Math.max(1, puntos)) as 1 | 2 | 3 | 4
  const cumple = p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)

  return {
    nivel,
    cumple,
    // El mensaje dice qué falta, no solo que algo falta: "usa una mayúscula"
    // es accionable, "contraseña débil" obliga a adivinar.
    mensaje: cumple ? 'Cumple los requisitos.' : queFalta(p),
  }
}

function queFalta(p: string): string {
  const faltantes: string[] = []
  if (p.length < 8) faltantes.push('8 caracteres')
  if (!/[A-Z]/.test(p)) faltantes.push('una mayúscula')
  if (!/[a-z]/.test(p)) faltantes.push('una minúscula')
  if (!/[0-9]/.test(p)) faltantes.push('un número')

  if (faltantes.length === 1) return `Te falta ${faltantes[0]}.`
  const ultimo = faltantes.pop()
  return `Te faltan ${faltantes.join(', ')} y ${ultimo}.`
}

const ETIQUETAS = ['', 'débil', 'regular', 'bien', 'fuerte'] as const
const COLORES = ['', 'bg-rojo', 'bg-ambar', 'bg-ambar', 'bg-verde'] as const

export function MedidorFortaleza({ fuerza }: { fuerza: Fortaleza }) {
  if (fuerza.nivel === 0) return null

  return (
    <div className="mt-2.5">
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
      <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-tenue">
        {fuerza.cumple ? (
          <Check className="mt-px size-3.5 shrink-0 text-verde" aria-hidden />
        ) : (
          <X className="mt-px size-3.5 shrink-0 text-rojo" aria-hidden />
        )}
        <span>
          {ETIQUETAS[fuerza.nivel]} · {fuerza.mensaje}
        </span>
      </p>
    </div>
  )
}
