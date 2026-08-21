import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Bell,
  Globe,
  type LucideIcon,
  LogOut,
  Moon,
  Pencil,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/estado/auth'
import { useI18n, useT } from '@/estado/i18n'
import { useEsOscuro } from '@/estado/tema'
import { useFinanzas } from '@/estado/finanzas'
import { useAvisos } from '@/estado/avisos'
import { Avatar } from './Avatar'

/**
 * Popover con las acciones rápidas del usuario.
 *
 * Se abre al hacer click en el avatar de Ajustes de la barra lateral.
 * Pensado para acceder a las acciones más usadas (editar perfil, tema,
 * cerrar sesión) sin tener que abrir el modal completo de "Editar perfil".
 *
 * "Eliminar cuenta" NO está aquí: vive dentro de Editar perfil > Zona
 * peligrosa, que es el flujo correcto para una acción irreversible.
 *
 * Se posiciona con `position: fixed` (no `absolute`) para que no quede
 * atrapado en el stacking context del sidebar y para que siempre sea
 * visible aunque el sidebar esté en cualquier estado.
 *
 * Se cierra con click fuera, Escape o después de ejecutar una acción.
 */
export type PosicionMenu = {
  /** Coordenada top en píxeles del viewport. Se ignora si `bottom` está definido. */
  top?: number
  /** Coordenada bottom en píxeles del viewport. Tiene prioridad sobre `top`. */
  bottom?: number
  /** Coordenada left en píxeles del viewport. */
  left: number
  /** Punto de origen para la animación (CSS `transform-origin`). */
  originX: 'left' | 'right' | 'center'
  originY: 'top' | 'bottom' | 'center'
}

export function MenuUsuario({
  abierto,
  onCerrar,
  onAbrirEditorPerfil,
  posicion,
}: {
  abierto: boolean
  onCerrar: () => void
  onAbrirEditorPerfil: () => void
  posicion: PosicionMenu | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()
  const { usuario, cerrarSesion } = useAuth()
  const { ajustes, guardarAjustes } = useFinanzas()
  const { mostrar } = useAvisos()
  const t = useT()
  const i18n = useI18n()
  const esOscuro = useEsOscuro()
  const reducido = useReducedMotion()

  // Cerrar con click fuera
  useEffect(() => {
    if (!abierto) return
    const alClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCerrar()
      }
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('mousedown', alClickFuera)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClickFuera)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto, onCerrar])

  const handleCerrarSesion = async () => {
    onCerrar()
    await cerrarSesion()
    navegar('/login')
  }

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          ref={ref}
          role="menu"
          initial={reducido ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reducido ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.96 }}
          transition={
            reducido
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 32 }
          }
          style={
            posicion
              ? {
                  // `bottom` toma precedencia: cuando el menú se ancla al
                  // borde de abajo del viewport, dejamos que `top` lo decida
                  // el contenido (junto con `max-h` y `overflow-y-auto` se
                  // mantiene dentro de pantalla aunque sea muy largo).
                  ...(posicion.bottom !== undefined
                    ? { bottom: posicion.bottom }
                    : { top: posicion.top }),
                  left: posicion.left,
                  transformOrigin: `${posicion.originX} ${posicion.originY}`,
                }
              : { display: 'none' }
          }
          className="fixed z-50 max-h-[calc(100dvh-32px)] w-72 overflow-y-auto rounded-2xl border border-borde bg-superficie p-1.5 shadow-tarjeta"
        >
          {/* Header: avatar + nombre + email */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <Avatar
              nombre={usuario?.displayName || usuario?.email || '?'}
              foto={usuario?.fotoUrl}
              tamano="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-tinta">
                {usuario?.displayName || t('ajustes.sin_nombre')}
              </p>
              <p className="truncate text-xs text-suave">{usuario?.email}</p>
            </div>
          </div>

          <div className="my-1 h-px bg-borde" />

          {/* Acciones de cuenta */}
          <Item
            icono={Pencil}
            etiqueta={t('ajustes.editar_perfil')}
            alClick={() => {
              onCerrar()
              onAbrirEditorPerfil()
            }}
          />
          <Item
            icono={User}
            etiqueta={t('menu.cuenta')}
            alClick={() => {
              onCerrar()
              navegar('/ajustes')
            }}
          />
          <Item
            icono={Globe}
            etiqueta={t('ajustes.idioma')}
            valor={i18n.idioma === 'es' ? 'Español' : 'English'}
            alClick={() => {
              onCerrar()
              void i18n.setIdioma(i18n.idioma === 'es' ? 'en' : 'es')
              mostrar(t('aviso.idioma_cambiado'))
            }}
          />
          <Item
            icono={Bell}
            etiqueta={t('ajustes.avisar_pagos')}
            valor={ajustes.notificacionesActivas ? t('comun.activo') : t('comun.inactivo')}
            alClick={() => {
              onCerrar()
              navegar('/ajustes')
            }}
          />

          {/* Administración. En escritorio también vive en la barra lateral,
              pero la barra no existe en móvil y este menú era el único camino
              que quedaba: sin esta entrada, un admin con teléfono no tenía
              forma de llegar al panel. */}
          {usuario?.rol === 'admin' && (
            <Item
              icono={Shield}
              etiqueta={t('admin.titulo')}
              alClick={() => {
                onCerrar()
                navegar('/admin')
              }}
            />
          )}

          <div className="my-1 h-px bg-borde" />

          {/* Tema oscuro / claro */}
          <Item
            icono={esOscuro ? Sun : Moon}
            etiqueta={esOscuro ? t('tema.claro') : t('tema.oscuro')}
            alClick={() => {
              void guardarAjustes({ tema: esOscuro ? 'claro' : 'oscuro' })
            }}
          />

          <div className="my-1 h-px bg-borde" />

          <Item
            icono={LogOut}
            etiqueta={t('menu.cerrar_sesion')}
            alClick={() => void handleCerrarSesion()}
            peligro
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Item de menú con icono, etiqueta y opcional valor a la derecha. */
function Item({
  icono: Icono,
  etiqueta,
  valor,
  alClick,
  peligro,
}: {
  icono: LucideIcon
  etiqueta: string
  valor?: string
  alClick: () => void
  peligro?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={alClick}
      className={
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ' +
        (peligro
          ? 'text-rojo hover:bg-rojo/10'
          : 'text-tinta hover:bg-elevada')
      }
    >
      <Icono className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 text-left">{etiqueta}</span>
      {valor && <span className="text-xs text-tenue">{valor}</span>}
    </button>
  )
}
