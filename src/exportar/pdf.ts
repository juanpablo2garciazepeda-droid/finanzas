import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ContextoFinanciero } from '@/dominio/alertas'
import type { PagoDeuda } from '@/dominio/tipos'
import { calcularMargen } from '@/dominio/alertas'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFecha, nombrePeriodo } from '@/dominio/fechas'
import { deudaTotal, proyectarDeuda } from '@/dominio/deudas'
import { ahorroTotal, proyectarMeta } from '@/dominio/metas'
import {
  calcularEstados,
  presupuestosDelPeriodo,
  transaccionesDelPeriodo,
} from '@/dominio/presupuestos'
import { calcularSalud } from '@/dominio/salud'
import { METODOS_CSV } from './etiquetas'

/** Reporte mensual en PDF, con los mismos colores que la interfaz. */

const TINTA = '#1D1D1F'
const SUAVE = '#86868B'
const ACENTO = '#0071E3'

export function generarReporteMensual(ctx: ContextoFinanciero, pagos: PagoDeuda[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const { moneda, locale } = ctx.ajustes
  const dinero = (c: number) => formatearMoneda(c, moneda, locale)

  const margen = calcularMargen(ctx)
  const salud = calcularSalud(ctx)
  const delPeriodo = transaccionesDelPeriodo(ctx.transacciones, ctx.periodo).sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  )
  const porId = new Map(ctx.categorias.map((c) => [c.id, c.nombre]))

  doc.setFontSize(20)
  doc.setTextColor(TINTA)
  doc.text('Juanpa Finanzas', 40, 52)
  doc.setFontSize(11)
  doc.setTextColor(SUAVE)
  doc.text(`Reporte de ${nombrePeriodo(ctx.periodo)}`, 40, 70)
  doc.text(`Generado el ${formatearFecha(ctx.hoy, locale)}`, 40, 85)

  autoTable(doc, {
    startY: 105,
    head: [['Resumen del mes', '']],
    body: [
      ['Ingresos', dinero(margen.ingresos)],
      ['Egresos', dinero(margen.egresos)],
      ['Balance', dinero(margen.balance)],
      ['Compromiso de deuda', dinero(margen.compromisoDeuda)],
      ['Aporte pendiente a metas', dinero(margen.compromisoMeta)],
      ['Margen libre', dinero(margen.margenLibre)],
      ['Deuda total', dinero(deudaTotal(ctx.deudas))],
      ['Ahorro total', dinero(ahorroTotal(ctx.metas))],
      ['Salud financiera', `${salud.puntaje}/100 · ${salud.etiqueta}`],
    ],
    theme: 'plain',
    headStyles: { textColor: ACENTO, fontStyle: 'bold', fontSize: 12 },
    bodyStyles: { textColor: TINTA, fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  })

  const estados = calcularEstados(
    presupuestosDelPeriodo(ctx.presupuestos, ctx.periodo),
    delPeriodo,
    ctx.categorias,
    ctx.ajustes.umbralPrecaucion,
  )
  if (estados.length > 0) {
    autoTable(doc, {
      head: [['Presupuesto', 'Límite', 'Gastado', 'Restante', 'Uso']],
      body: estados.map((e) => [
        e.nombre,
        dinero(e.limite),
        dinero(e.gastado),
        dinero(e.restante),
        `${Math.round(e.consumo * 100)}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: ACENTO, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
  }

  const activas = ctx.deudas.filter((d) => !d.liquidada)
  if (activas.length > 0) {
    autoTable(doc, {
      head: [['Deuda', 'Saldo', 'Tasa', 'Ritmo mensual', 'Se liquida']],
      body: activas.map((d) => {
        const p = proyectarDeuda(d, pagos, ctx.hoy)
        return [
          d.acreedor,
          dinero(d.saldoActual),
          d.tasaInteres ? `${d.tasaInteres}%` : '—',
          dinero(p.ritmoUsado),
          p.periodoLiquidacion ? nombrePeriodo(p.periodoLiquidacion) : 'Nunca a este ritmo',
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: ACENTO, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
  }

  const metasActivas = ctx.metas.filter((m) => !m.completada)
  if (metasActivas.length > 0) {
    autoTable(doc, {
      head: [['Meta', 'Ahorrado', 'Objetivo', 'Avance', 'Proyección']],
      body: metasActivas.map((m) => {
        const p = proyectarMeta(m, ctx.aportes, ctx.hoy)
        return [
          m.nombre,
          dinero(m.montoActual),
          dinero(m.montoObjetivo),
          `${Math.round(p.avance * 100)}%`,
          p.periodoProyectado ? nombrePeriodo(p.periodoProyectado) : 'Sin ritmo definido',
        ]
      }),
      theme: 'striped',
      headStyles: { fillColor: ACENTO, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
  }

  if (delPeriodo.length > 0) {
    autoTable(doc, {
      head: [['Fecha', 'Tipo', 'Categoría', 'Método', 'Nota', 'Monto']],
      body: delPeriodo.map((t) => [
        formatearFecha(t.fecha, locale),
        t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
        porId.get(t.categoriaId) ?? 'Sin categoría',
        METODOS_CSV[t.metodoPago],
        t.nota,
        `${t.tipo === 'ingreso' ? '+' : '-'}${dinero(t.monto)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: ACENTO, fontSize: 10 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    })
  }

  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(SUAVE)
    doc.text(`Página ${i} de ${paginas}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 24, {
      align: 'right',
    })
  }

  return doc
}

export function descargarReporteMensual(ctx: ContextoFinanciero, pagos: PagoDeuda[]) {
  generarReporteMensual(ctx, pagos).save(`juanpa-finanzas-${ctx.periodo}.pdf`)
}
