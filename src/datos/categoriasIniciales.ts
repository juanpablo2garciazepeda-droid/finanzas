import { PALETA_CATEGORIAS } from '@/graficas/paleta'

/**
 * Antes este archivo sembraba las categorías en IndexedDB al instalar. Ahora
 * el backend las siembra al registrarse, así que solo conservamos la paleta y
 * el catálogo de iconos: la UI los ofrece al crear o editar una categoría.
 */

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
