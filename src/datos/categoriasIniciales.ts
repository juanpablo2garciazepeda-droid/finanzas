import type { Categoria } from '@/dominio/tipos'
import { PALETA_CATEGORIAS } from '@/graficas/paleta'

/**
 * Las categorías con las que arranca la app. `esSistema` solo evita el borrado
 * accidental: el nombre, el icono y el color se pueden cambiar todos.
 *
 * Los colores salen de la paleta validada para fondo claro. Las ocho categorías
 * de mayor gasto llevan cada una un color distinto; las de cola repiten, que es
 * donde una repetición no estorba porque casi nunca coinciden en la gráfica.
 */
export const CATEGORIAS_INICIALES: Omit<Categoria, 'id' | 'orden'>[] = [
  { nombre: 'Comida', tipo: 'egreso', icono: 'Utensils', color: '#BC670D', esSistema: true, archivada: false },
  { nombre: 'Súper', tipo: 'egreso', icono: 'ShoppingCart', color: '#90790C', esSistema: true, archivada: false },
  { nombre: 'Transporte', tipo: 'egreso', icono: 'Car', color: '#0F84D8', esSistema: true, archivada: false },
  { nombre: 'Renta', tipo: 'egreso', icono: 'House', color: '#7968EB', esSistema: true, archivada: false },
  { nombre: 'Servicios', tipo: 'egreso', icono: 'Zap', color: '#139EA0', esSistema: true, archivada: false },
  { nombre: 'Entretenimiento', tipo: 'egreso', icono: 'Clapperboard', color: '#C149AC', esSistema: true, archivada: false },
  { nombre: 'Salud', tipo: 'egreso', icono: 'HeartPulse', color: '#10924B', esSistema: true, archivada: false },
  { nombre: 'Educación', tipo: 'egreso', icono: 'GraduationCap', color: '#0F84D8', esSistema: true, archivada: false },
  { nombre: 'Compras', tipo: 'egreso', icono: 'ShoppingBag', color: '#E2484F', esSistema: true, archivada: false },
  { nombre: 'Suscripciones', tipo: 'egreso', icono: 'Repeat', color: '#10924B', esSistema: true, archivada: false },
  { nombre: 'Mascotas', tipo: 'egreso', icono: 'PawPrint', color: '#C149AC', esSistema: true, archivada: false },
  { nombre: 'Otros gastos', tipo: 'egreso', icono: 'Ellipsis', color: '#90790C', esSistema: true, archivada: false },

  { nombre: 'Sueldo', tipo: 'ingreso', icono: 'Briefcase', color: '#10924B', esSistema: true, archivada: false },
  { nombre: 'Freelance', tipo: 'ingreso', icono: 'Laptop', color: '#139EA0', esSistema: true, archivada: false },
  { nombre: 'Ventas', tipo: 'ingreso', icono: 'Store', color: '#90790C', esSistema: true, archivada: false },
  { nombre: 'Regalos', tipo: 'ingreso', icono: 'Gift', color: '#C149AC', esSistema: true, archivada: false },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'Ellipsis', color: '#0F84D8', esSistema: true, archivada: false },
]

/** Paleta que se ofrece al crear o editar una categoría. */
export const PALETA = PALETA_CATEGORIAS

/** Iconos disponibles al crear o editar una categoría. */
export const ICONOS = [
  'Utensils',
  'ShoppingCart',
  'ShoppingBag',
  'Car',
  'Bus',
  'Fuel',
  'House',
  'Zap',
  'Wifi',
  'Phone',
  'Clapperboard',
  'Music',
  'Gamepad2',
  'HeartPulse',
  'Pill',
  'Dumbbell',
  'GraduationCap',
  'BookOpen',
  'Repeat',
  'PawPrint',
  'Plane',
  'Gift',
  'Briefcase',
  'Laptop',
  'Store',
  'PiggyBank',
  'Shield',
  'Coffee',
  'Shirt',
  'Baby',
  'Wrench',
  'Ellipsis',
]
