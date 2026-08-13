import type { Categoria, Transaccion } from '@/dominio/tipos'
import { aPesos } from '@/dominio/dinero'
import { METODOS_CSV } from './etiquetas'

/**
 * CSV pensado para abrirse directo en Excel y Numbers: BOM UTF-8 para que los
 * acentos no salgan rotos y montos con punto decimal, que es lo que espera la
 * configuración regional de México.
 */

function escapar(valor: string | number): string {
  const texto = String(valor)
  return /[",;\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

export function generarCSV(filas: (string | number)[][]): string {
  return '﻿' + filas.map((fila) => fila.map(escapar).join(',')).join('\r\n')
}

export function descargar(contenido: string, nombre: string, tipoMime: string) {
  const blob = new Blob([contenido], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export function movimientosACSV(transacciones: Transaccion[], categorias: Categoria[]): string {
  const porId = new Map(categorias.map((c) => [c.id, c.nombre]))
  const filas: (string | number)[][] = [
    ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Método de pago', 'Nota'],
    ...transacciones.map((t) => [
      t.fecha,
      t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      porId.get(t.categoriaId) ?? 'Sin categoría',
      aPesos(t.monto).toFixed(2),
      METODOS_CSV[t.metodoPago] ?? t.metodoPago,
      t.nota,
    ]),
  ]
  return generarCSV(filas)
}

export function descargarMovimientosCSV(
  transacciones: Transaccion[],
  categorias: Categoria[],
  nombre: string,
) {
  descargar(movimientosACSV(transacciones, categorias), `${nombre}.csv`, 'text/csv;charset=utf-8')
}
