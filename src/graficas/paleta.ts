/**
 * Paleta de las gráficas.
 *
 * Todos estos valores pasan las cinco comprobaciones del validador de paletas
 * sobre las dos superficies claras de la app, #FFFFFF y #F5F5F7: banda de
 * luminosidad OKLCH 0.43–0.77, croma mínimo 0.10, separación para daltonismo
 * protan/deutan/tritan, separación en visión normal y contraste ≥ 3:1.
 * No cambiar un hex sin volver a validarlo.
 *
 * El acento de la interfaz (#0071E3) queda fuera a propósito: su trabajo es
 * marcar controles activos, no identificar series de datos.
 */

/** Orden fijo. Nunca se cicla: una novena serie se agrupa en "Otras". */
export const SERIES = [
  '#10924B',
  '#0F84D8',
  '#E2484F',
  '#7968EB',
  '#139EA0',
  '#BC670D',
  '#C149AC',
  '#90790C',
] as const

/** Asignaciones fijas por entidad: el color sigue al concepto, no al orden. */
export const COLOR = {
  ingresos: '#139EA0',
  egresos: '#BC670D',
  deuda: '#E2484F',
  ahorro: '#0F84D8',
  balance: '#86868B',
} as const

/**
 * Opciones de color al crear o editar una categoría: las mismas ocho series.
 * Más de ocho tonos categóricos no logran separarse bajo daltonismo por mucho
 * que se busquen, así que ofrecer doce sería fingir una precisión que no hay.
 */
export const PALETA_CATEGORIAS: string[] = [...SERIES]

/** Rejilla y ejes: recesivos en ambos temas, nunca compiten con los datos. */
export function cromoDe(esOscuro: boolean) {
  return esOscuro
    ? { rejilla: '#38383A', eje: '#8E8E93', superficie: '#1C1C1E' }
    : { rejilla: '#E5E5EA', eje: '#86868B', superficie: '#FFFFFF' }
}
