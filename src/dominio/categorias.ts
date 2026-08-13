import type { Categoria, Transaccion } from './tipos'

/**
 * Ordena el selector del formulario poniendo delante lo que la persona más
 * usa. Registrar un gasto debe costar dos toques, y eso solo pasa si la
 * categoría de siempre está arriba; el orden configurado desempata.
 */
export function ordenarPorUso(
  categorias: Categoria[],
  transacciones: Transaccion[],
  desde: string,
): Categoria[] {
  const usos = new Map<string, number>()
  for (const t of transacciones) {
    if (t.fecha < desde) continue
    usos.set(t.categoriaId, (usos.get(t.categoriaId) ?? 0) + 1)
  }
  return [...categorias].sort((a, b) => {
    const diferencia = (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0)
    return diferencia !== 0 ? diferencia : a.orden - b.orden
  })
}
