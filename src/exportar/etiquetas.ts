import type { MetodoPago, Periodicidad } from '@/dominio/tipos'

export const METODOS_CSV: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

export const PERIODICIDAD: Record<Periodicidad, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  unico: 'Pago único',
}
