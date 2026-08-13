import { useEffect, useSyncExternalStore } from 'react'
import type { Acento, Tema } from '@/dominio/tipos'
import { useFinanzas } from './finanzas'

/**
 * El tema vive en un atributo del `<html>`; el CSS hace el resto. `data-tema`
 * solo se escribe cuando la persona elige claro u oscuro: en "sistema" se
 * quita, y ahí manda `prefers-color-scheme`.
 */

const CONSULTA = '(prefers-color-scheme: dark)'
const CLAVE_TEMA = 'finanzas.tema'
const CLAVE_ACENTO = 'finanzas.acento'

/**
 * Aplica la apariencia guardada antes de que React monte nada. La pantalla de
 * bloqueo y el primer pintado ocurren antes de leer IndexedDB, y sin esto se
 * ve un parpadeo de tema claro en quien eligió oscuro.
 */
export function aplicarAparienciaGuardada(): void {
  const raiz = document.documentElement
  const tema = localStorage.getItem(CLAVE_TEMA)
  const acento = localStorage.getItem(CLAVE_ACENTO)
  if (tema === 'claro' || tema === 'oscuro') raiz.setAttribute('data-tema', tema)
  if (acento) raiz.setAttribute('data-acento', acento)
}

function suscribirse(alCambiar: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(CONSULTA)
  media.addEventListener('change', alCambiar)
  return () => media.removeEventListener('change', alCambiar)
}

function sistemaEsOscuro(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA).matches
}

/** Si el sistema está en oscuro. Se reevalúa cuando el sistema cambia. */
export function usePreferenciaSistema(): boolean {
  return useSyncExternalStore(suscribirse, sistemaEsOscuro, () => false)
}

/** El tema que está pintado ahora mismo, resolviendo "sistema". */
export function useEsOscuro(): boolean {
  const { ajustes } = useFinanzas()
  const sistema = usePreferenciaSistema()
  if (ajustes.tema === 'oscuro') return true
  if (ajustes.tema === 'claro') return false
  return sistema
}

/** Aplica tema y acento al documento. Se monta una sola vez, en App. */
export function useAplicarApariencia(): void {
  const { ajustes } = useFinanzas()

  useEffect(() => {
    const raiz = document.documentElement
    if (ajustes.tema === 'sistema') raiz.removeAttribute('data-tema')
    else raiz.setAttribute('data-tema', ajustes.tema)
    raiz.setAttribute('data-acento', ajustes.acento)
    // Copia en localStorage para poder pintarlo antes de abrir la base.
    localStorage.setItem(CLAVE_TEMA, ajustes.tema)
    localStorage.setItem(CLAVE_ACENTO, ajustes.acento)
  }, [ajustes.tema, ajustes.acento])

  const esOscuro = useEsOscuro()

  // La barra del navegador en móvil tiene que ir a juego, o queda una franja
  // blanca sobre una app oscura.
  useEffect(() => {
    const etiqueta = document.querySelector('meta[name="theme-color"]')
    etiqueta?.setAttribute('content', esOscuro ? '#000000' : '#F5F5F7')
  }, [esOscuro])
}

export const NOMBRE_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Automático',
}

/** Muestra del color en el selector de acento. Coincide con el CSS. */
export const MUESTRA_ACENTO: Record<Acento, { claro: string; oscuro: string; nombre: string }> = {
  azul: { claro: '#0071E3', oscuro: '#0A84FF', nombre: 'Azul' },
  morado: { claro: '#8944AB', oscuro: '#BF5AF2', nombre: 'Morado' },
  rosa: { claro: '#C9186B', oscuro: '#FF375F', nombre: 'Rosa' },
  naranja: { claro: '#BF4B00', oscuro: '#FF9F0A', nombre: 'Naranja' },
  verde: { claro: '#197A3D', oscuro: '#30D158', nombre: 'Verde' },
  grafito: { claro: '#3A3A3C', oscuro: '#D1D1D6', nombre: 'Grafito' },
}
