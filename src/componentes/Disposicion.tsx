import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Pin,
  PinOff,
  Plus,
  Receipt,
  Shield,
  Target,
  Wallet,
  X,
} from 'lucide-react'
import { nombrePeriodo, periodoActual, sumarMeses } from '@/dominio/fechas'
import { useFinanzas } from '@/estado/finanzas'
import { useAuth } from '@/estado/auth'
import { useT } from '@/estado/i18n'
import { clases } from './ui/Basicos'
import { Avatar } from './Avatar'
import { Logotipo, MarcaGZ } from './Marca'
import { FormularioMovimiento } from './FormularioMovimiento'
import { MenuUsuario, type PosicionMenu } from './MenuUsuario'
import { EditorPerfil } from './EditorPerfil'
import { useEditorPerfil } from '@/estado/editorPerfil'

const ANCHO_MENU = 288 // w-72 de Tailwind

/**
 * Calcula la posición del popover según el trigger y el ancho del sidebar.
 * En desktop el menú va pegado a la esquina inferior derecha del sidebar.
 * En mobile va debajo del trigger, alineado a la derecha.
 */
function calcularPosicionMenu(
  trigger: HTMLElement,
  anchoSidebar: number,
  esDesktop: boolean,
): PosicionMenu {
  const caja = trigger.getBoundingClientRect()
  if (esDesktop) {
    return {
      top: window.innerHeight - 16, // 16px de margen inferior
      left: anchoSidebar + 8,
      originX: 'left',
      originY: 'bottom',
    }
  }
  // Mobile: debajo del trigger, alineado a la derecha
  return {
    top: caja.bottom + 8,
    left: Math.max(8, caja.right - ANCHO_MENU),
    originX: 'right',
    originY: 'top',
  }
}

// La etiqueta es una clave del diccionario, no el texto: si se guarda ya
// traducida, la barra se queda en el idioma que hubiera al cargar el módulo.
const SECCIONES = [
  { ruta: '/', clave: 'tablero.titulo', Icono: LayoutDashboard },
  { ruta: '/movimientos', clave: 'movimientos.titulo', Icono: Receipt },
  { ruta: '/presupuestos', clave: 'presupuestos.titulo', Icono: Wallet },
  { ruta: '/deudas', clave: 'deudas.titulo', Icono: CreditCard },
  { ruta: '/metas', clave: 'metas.titulo', Icono: Target },
]

/** Ancho de la barra lateral en píxeles, en cada estado. */
const ANCHO_COLAPSADO = 68
const ANCHO_EXPANDIDO = 248

/**
 * Estado pineado del sidebar, persistido en localStorage.
 *
 * - `null`  → nunca se decidió, no persistir todavía (default colapsado).
 * - `true`  → pineado expandido, persiste entre sesiones.
 * - `false` → pineado colapsado, persiste entre sesiones.
 */
function usePineado(): [boolean, (v: boolean) => void] {
  const [pineado, setPineadoInterno] = useState<boolean | null>(null)
  useEffect(() => {
    const guardado = localStorage.getItem('gz.sidebarPineado')
    if (guardado === 'true') setPineadoInterno(true)
    else if (guardado === 'false') setPineadoInterno(false)
    else setPineadoInterno(false)
  }, [])
  const setPineado = (v: boolean) => {
    setPineadoInterno(v)
    localStorage.setItem('gz.sidebarPineado', String(v))
  }
  return [pineado ?? false, setPineado]
}

/**
 * `true` cuando un campo de texto está enfocado. La barra inferior y el FAB
 * se ocultan mientras tanto: en iOS el teclado virtual empuja esos
 * `position: fixed` justo encima de los números, y al hacer scroll la barra
 * se queda pegada sobre el input como un bulto fuera de lugar. Lo detecta
 * `focusin`/`focusout` en el document, no un listener por input, para no
 * atar el comportamiento a cuántos forms haya.
 */
function useTecladoActivo(): boolean {
  const [activo, setActivo] = useState(false)
  useEffect(() => {
    const esCampo = (el: EventTarget | null): boolean =>
      el instanceof HTMLElement && el.matches('input, select, textarea, [contenteditable="true"]')
    const alEntrar = (e: FocusEvent) => {
      if (esCampo(e.target)) setActivo(true)
    }
    const alSalir = (e: FocusEvent) => {
      if (!esCampo(e.relatedTarget)) setActivo(false)
    }
    document.addEventListener('focusin', alEntrar)
    document.addEventListener('focusout', alSalir)
    return () => {
      document.removeEventListener('focusin', alEntrar)
      document.removeEventListener('focusout', alSalir)
    }
  }, [])
  return activo
}

export function Disposicion({ children }: { children: ReactNode }) {
  const [registrando, setRegistrando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [posicionMenu, setPosicionMenu] = useState<PosicionMenu | null>(null)
  const { pathname } = useLocation()
  const { usuario } = useAuth()
  const editorPerfil = useEditorPerfil()
  const enAjustes = pathname === '/ajustes'
  const tecladoActivo = useTecladoActivo()
  const reducido = useReducedMotion()

  const abrirMenu = (trigger: HTMLElement, esDesktop: boolean) => {
    setPosicionMenu(calcularPosicionMenu(trigger, ANCHO_EXPANDIDO, esDesktop))
    setMenuAbierto(true)
  }
  const cerrarMenu = () => {
    setMenuAbierto(false)
    // No limpiamos `posicionMenu` aquí: queremos que la animación de salida
    // use la misma posición que la de entrada. Se limpia al cerrarse.
  }

  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral
        menuAbierto={menuAbierto}
        onToggleMenu={(trigger) => abrirMenu(trigger, true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado
          onAbrirMenu={(trigger) => abrirMenu(trigger, false)}
        />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-32 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {!enAjustes && (
        <motion.button
          type="button"
          onClick={() => setRegistrando(true)}
          aria-label="Registrar movimiento"
          className="fixed right-5 bottom-24 z-30 flex size-14 items-center justify-center rounded-full bg-acento text-sobre-acento shadow-flotante lg:bottom-8"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          animate={{
            y: tecladoActivo ? 120 : 0,
            scale: tecladoActivo ? 0.85 : 1,
            opacity: tecladoActivo ? 0 : 1,
          }}
          transition={reducido ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
          whileTap={reducido ? undefined : { scale: 0.92 }}
        >
          <Plus className="size-7" strokeWidth={2.25} aria-hidden />
        </motion.button>
      )}

      <NavegacionMovil tecladoActivo={tecladoActivo} />

      <FormularioMovimiento abierto={registrando} onCerrar={() => setRegistrando(false)} />

      {editorPerfil.abierto && usuario && (
        <EditorPerfil onCerrar={editorPerfil.cerrar} />
      )}

      <MenuUsuario
        abierto={menuAbierto}
        onCerrar={cerrarMenu}
        onAbrirEditorPerfil={() => editorPerfil.abrir()}
        posicion={posicionMenu}
      />
    </div>
  )
}

function BarraLateral({
  menuAbierto,
  onToggleMenu,
}: {
  menuAbierto: boolean
  onToggleMenu: (trigger: HTMLElement) => void
}) {
  const { usuario } = useAuth()
  const t = useT()
  const [pineado, setPineado] = usePineado()
  const [enHover, setEnHover] = useState(false)
  const editorPerfil = useEditorPerfil()
  const reducido = useReducedMotion()
  const { pathname } = useLocation()

  // Si el EditorPerfil está abierto, el sidebar no responde al mouse y se
  // colapsa, para que la atención se vaya al modal sin nada detrás.
  // Si el menú del usuario está abierto, el sidebar se queda expandido
  // (sin importar pin ni hover) para que el popover quede alineado.
  const expandido = editorPerfil.abierto
    ? false
    : menuAbierto || pineado || enHover
  const enAjustes = pathname === '/ajustes'
  const enAjustesOpciones =
    enAjustes || menuAbierto

  return (
    <motion.aside
      onMouseEnter={() => !editorPerfil.abierto && setEnHover(true)}
      onMouseLeave={() => !editorPerfil.abierto && setEnHover(false)}
      animate={{ width: expandido ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO }}
      transition={
        reducido
          ? { duration: 0 }
          : { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }
      }
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-borde bg-superficie py-6 lg:flex"
    >
      <div className="flex items-center justify-between px-4 pb-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <MarcaGZ tamano={expandido ? 28 : 32} />
          <motion.span
            initial={false}
            animate={{
              opacity: expandido ? 1 : 0,
              width: expandido ? 'auto' : 0,
            }}
            transition={{ duration: reducido ? 0 : 0.15, delay: expandido ? 0.08 : 0 }}
            className="overflow-hidden whitespace-nowrap font-display text-[17px] font-semibold tracking-[-0.03em] text-tinta"
          >
            Finanzas <span className="text-acento">GZ</span>
          </motion.span>
        </div>
        {expandido && (
          <button
            type="button"
            onClick={() => setPineado(!pineado)}
            aria-label={pineado ? 'Despinear barra lateral' : 'Pinear barra lateral'}
            title={pineado ? 'Despinear' : 'Pinear expandido'}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-tenue transition-colors hover:bg-elevada hover:text-tinta"
          >
            {pineado ? (
              <Pin className="size-3.5" aria-hidden style={{ fill: 'currentColor' }} />
            ) : (
              <PinOff className="size-3.5" aria-hidden />
            )}
          </button>
        )}
      </div>

      {/* `min-h-0` es lo que permite que este bloque se encoja dentro del
          `h-dvh` de la barra. Sin él, un flex item con `flex-1` no baja de la
          altura de su contenido: con seis secciones y una ventana corta, el
          botón de Ajustes quedaba empujado por debajo del borde inferior y no
          había forma de alcanzarlo. Con `overflow-y-auto` las secciones hacen
          scroll entre ellas y el pie queda siempre visible. */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
        {SECCIONES.map(({ ruta, clave, Icono }) => (
          <ItemNav
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            etiqueta={t(clave)}
            Icono={Icono}
            expandida={expandido}
          />
        ))}
        {/* Item de admin: solo visible para usuarios con rol 'admin'. */}
        {usuario?.rol === 'admin' && (
          <ItemNav
            to="/admin"
            etiqueta={t('admin.titulo')}
            Icono={Shield}
            expandida={expandido}
          />
        )}
      </nav>

      <div className="relative shrink-0 px-3 pt-1">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          onClick={(e) => onToggleMenu(e.currentTarget)}
          className={clases(
            'relative flex w-full items-center rounded-xl py-2.5 text-sm transition-colors',
            expandido ? 'gap-3 px-3' : 'justify-center px-0',
            enAjustesOpciones
              ? 'text-acento font-semibold'
              : 'text-suave font-medium hover:text-tinta',
          )}
        >
          {usuario ? (
            <Avatar
              nombre={usuario.displayName || usuario.email}
              foto={usuario.fotoUrl}
              tamano="sm"
            />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-elevada" />
          )}
          <motion.span
            initial={false}
            animate={{
              opacity: expandido ? 1 : 0,
              width: expandido ? 'auto' : 0,
            }}
            transition={{ duration: reducido ? 0 : 0.15, delay: expandido ? 0.08 : 0 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {t('ajustes.titulo')}
          </motion.span>
        </button>
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            scaleY: enAjustesOpciones ? 1 : 0,
            opacity: enAjustesOpciones ? 1 : 0,
          }}
          transition={
            reducido
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 30 }
          }
          style={{ originY: 0.5 }}
          className="absolute left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-acento"
        />
      </div>
    </motion.aside>
  )
}

/** Item de navegación con etiqueta que se desvanece y tooltip flotante. */
function ItemNav({
  to,
  end,
  etiqueta,
  Icono,
  avatar,
  expandida,
  conHighlight = true,
}: {
  to: string
  end?: boolean
  etiqueta: string
  Icono?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  avatar?: ReactNode
  expandida: boolean
  /** Si false, no muestra el dot indicador (útil para Ajustes con su propio highlight). */
  conHighlight?: boolean
}) {
  const reducido = useReducedMotion()
  const [mostrarTooltip, setMostrarTooltip] = useState(false)
  const { pathname } = useLocation()
  const activo = end ? pathname === to : pathname.startsWith(to)

  return (
    <div
      className="relative"
      onMouseEnter={() => !expandida && setMostrarTooltip(true)}
      onMouseLeave={() => setMostrarTooltip(false)}
    >
      <NavLink
        to={to}
        end={end}
        className={clases(
          'relative flex items-center rounded-xl py-2.5 text-sm transition-colors',
          expandida ? 'gap-3 px-3' : 'justify-center px-0',
          activo
            ? 'text-acento font-semibold'
            : 'text-suave font-medium hover:text-tinta',
        )}
      >
        {Icono && (
          <Icono
            className="size-[18px] shrink-0"
            strokeWidth={activo ? 2.25 : 1.75}
            aria-hidden
          />
        )}
        {avatar && <span className="shrink-0">{avatar}</span>}
        <motion.span
          initial={false}
          animate={{
            opacity: expandida ? 1 : 0,
            width: expandida ? 'auto' : 0,
          }}
          transition={{ duration: reducido ? 0 : 0.15, delay: expandida ? 0.08 : 0 }}
          className="overflow-hidden whitespace-nowrap"
        >
          {etiqueta}
        </motion.span>
      </NavLink>

      {/* Dot indicador a la izquierda del item activo */}
      {conHighlight && (
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            scaleY: activo ? 1 : 0,
            opacity: activo ? 1 : 0,
          }}
          transition={
            reducido
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 30 }
          }
          style={{ originY: 0.5 }}
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-acento"
        />
      )}

      {/* Tooltip flotante cuando el sidebar está colapsado */}
      <AnimatePresence>
        {!expandida && mostrarTooltip && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: reducido ? 0 : 0.12 }}
            className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-tinta px-2.5 py-1 text-xs font-medium text-fondo shadow-tarjeta"
            role="tooltip"
          >
            {etiqueta}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Barra inferior con un indicador que viaja entre secciones.
 *
 * Antes el estado activo solo cambiaba de color, así que cambiar de sección se
 * sentía como un salto seco. Aquí una píldora se desliza con un resorte, el
 * icono responde al tocar (no al soltar) y se puede arrastrar el dedo por la
 * barra para recorrer las secciones antes de decidir.
 *
 * El resorte es lo que da la sensación física: `layoutId` hace que motion anime
 * la píldora entre posiciones, y `stiffness`/`damping` le dan masa sin rebote
 * de juguete.
 */
function NavegacionMovil({ tecladoActivo }: { tecladoActivo: boolean }) {
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const barra = useRef<HTMLDivElement>(null)
  const t = useT()
  const [arrastrando, setArrastrando] = useState(false)
  const [rutaPrevia, setRutaPrevia] = useState<string | null>(null)
  const reducido = useReducedMotion()

  const activa = SECCIONES.some((s) => s.ruta === pathname) ? pathname : '/'
  // Durante el arrastre manda el dedo; al soltar, la ruta real.
  const resaltada = arrastrando && rutaPrevia ? rutaPrevia : activa

  /** Qué sección cae bajo esta coordenada horizontal. */
  const seccionEn = (x: number): string | null => {
    const caja = barra.current?.getBoundingClientRect()
    if (!caja || x < caja.left || x > caja.right) return null
    const indice = Math.floor(((x - caja.left) / caja.width) * SECCIONES.length)
    return SECCIONES[Math.min(SECCIONES.length - 1, Math.max(0, indice))].ruta
  }

  const alMover = (x: number) => {
    const ruta = seccionEn(x)
    if (!ruta || ruta === rutaPrevia) return
    setRutaPrevia(ruta)
    // Un golpecito al cruzar de sección. En iOS no existe y no falla.
    navigator.vibrate?.(8)
  }

  return (
    <motion.nav
      className="area-segura-inferior fixed inset-x-0 bottom-0 z-30 border-t border-borde cristal lg:hidden"
      animate={{ y: tecladoActivo ? '120%' : 0 }}
      transition={reducido ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
    >
      <div
        ref={barra}
        className="mx-auto flex max-w-md touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setArrastrando(true)
          alMover(e.clientX)
        }}
        onPointerMove={(e) => arrastrando && alMover(e.clientX)}
        onPointerUp={() => {
          if (rutaPrevia && rutaPrevia !== activa) navegar(rutaPrevia)
          setArrastrando(false)
          setRutaPrevia(null)
        }}
        onPointerCancel={() => {
          setArrastrando(false)
          setRutaPrevia(null)
        }}
      >
        {SECCIONES.map(({ ruta, clave, Icono }) => {
          const esActiva = resaltada === ruta
          return (
            <button
              key={ruta}
              type="button"
              onClick={() => navegar(ruta)}
              aria-current={activa === ruta ? 'page' : undefined}
              // 44 px de alto mínimo: el área táctil no depende del icono.
              className={clases(
                'relative flex min-h-11 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
                esActiva ? 'text-acento' : 'text-tenue',
              )}
            >
              {esActiva && (
                <motion.span
                  layoutId="indicador-nav"
                  className="absolute inset-x-1.5 inset-y-1 -z-10 rounded-2xl bg-acento-suave"
                  transition={
                    reducido
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 32 }
                  }
                />
              )}
              <motion.span
                className="flex flex-col items-center gap-1"
                whileTap={reducido ? undefined : { scale: 0.92 }}
                animate={{ scale: arrastrando && esActiva ? 1.08 : 1 }}
                transition={
                  reducido ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }
                }
              >
                <Icono className="size-[22px]" strokeWidth={1.75} aria-hidden />
                <span className="max-w-full truncate px-0.5">{t(clave)}</span>
              </motion.span>
            </button>
          )
        })}
      </div>
    </motion.nav>
  )
}

function Encabezado({
  onAbrirMenu,
}: {
  onAbrirMenu: (trigger: HTMLElement) => void
}) {
  const { periodo, irAPeriodo, esPeriodoActual, esPeriodoMinimo } = useFinanzas()
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const enAjustes = pathname === '/ajustes'

  return (
    <header className="sticky top-0 z-20 cristal border-b border-borde">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="lg:hidden">
          <Logotipo compacto tamano={28} />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1 rounded-full bg-elevada p-1">
          <button
            type="button"
            onClick={() => irAPeriodo(sumarMeses(periodo, -1))}
            disabled={esPeriodoMinimo}
            aria-label="Mes anterior"
            className="rounded-lg p-1.5 text-suave transition-colors hover:bg-elevada hover:text-tinta disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => irAPeriodo(periodoActual())}
            disabled={esPeriodoActual}
            className="min-w-0 flex-1 truncate px-1 text-center text-sm font-medium text-tinta capitalize sm:min-w-30 disabled:cursor-default"
            title={esPeriodoActual ? undefined : 'Volver al mes actual'}
          >
            {nombrePeriodo(periodo)}
          </button>
          <button
            type="button"
            onClick={() => irAPeriodo(sumarMeses(periodo, 1))}
            disabled={esPeriodoActual}
            aria-label="Mes siguiente"
            className="rounded-lg p-1.5 text-suave transition-colors hover:bg-elevada hover:text-tinta disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        {/* En /ajustes el avatar se vuelve una X para volver al tablero:
            en el resto de la app abre el menú del usuario (popover). */}
        {enAjustes ? (
          <button
            type="button"
            onClick={() => navegar('/')}
            aria-label="Volver al tablero"
            title="Volver al tablero"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-elevada text-tinta transition-colors hover:bg-acento hover:text-sobre-acento lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            aria-haspopup="menu"
            aria-label="Menú de la cuenta"
            onClick={(e) => onAbrirMenu(e.currentTarget)}
            className="shrink-0 lg:hidden"
          >
            {usuario ? (
              <Avatar nombre={usuario.displayName || usuario.email} foto={usuario.fotoUrl} />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-full bg-elevada" />
            )}
          </button>
        )}
      </div>
    </header>
  )
}

