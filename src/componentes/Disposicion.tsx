import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Plus,
  Receipt,
  Target,
  Wallet,
} from 'lucide-react'
import { nombrePeriodo, periodoActual, sumarMeses } from '@/dominio/fechas'
import { useFinanzas } from '@/estado/finanzas'
import { useAuth } from '@/estado/auth'
import { clases } from './ui/Basicos'
import { Avatar } from './Avatar'
import { Logotipo } from './Marca'
import { FormularioMovimiento } from './FormularioMovimiento'

const SECCIONES = [
  { ruta: '/', etiqueta: 'Tablero', Icono: LayoutDashboard },
  { ruta: '/movimientos', etiqueta: 'Movimientos', Icono: Receipt },
  { ruta: '/presupuestos', etiqueta: 'Presupuestos', Icono: Wallet },
  { ruta: '/deudas', etiqueta: 'Deudas', Icono: CreditCard },
  { ruta: '/metas', etiqueta: 'Metas', Icono: Target },
]

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
  const { pathname } = useLocation()
  const enAjustes = pathname === '/ajustes'
  const tecladoActivo = useTecladoActivo()
  const reducido = useReducedMotion()

  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado />
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
    </div>
  )
}

function BarraLateral() {
  const { usuario } = useAuth()
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-6 lg:flex">
      <div className="px-3 pb-8">
        <Logotipo />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {SECCIONES.map(({ ruta, etiqueta, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            className={({ isActive }) =>
              clases(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-acento-suave text-acento' : 'text-suave hover:bg-elevada hover:text-tinta',
              )
            }
          >
            <Icono className="size-[18px]" strokeWidth={1.75} aria-hidden />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
      <NavLink
        to="/ajustes"
        className={({ isActive }) =>
          clases(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
            isActive ? 'bg-acento-suave text-acento' : 'text-suave hover:bg-elevada hover:text-tinta',
          )
        }
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
        Ajustes
      </NavLink>
    </aside>
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
        {SECCIONES.map(({ ruta, etiqueta, Icono }) => {
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
                <span className="max-w-full truncate px-0.5">{etiqueta}</span>
              </motion.span>
            </button>
          )
        })}
      </div>
    </motion.nav>
  )
}

function Encabezado() {
  const { periodo, irAPeriodo, esPeriodoActual } = useFinanzas()
  const { usuario } = useAuth()

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
            aria-label="Mes anterior"
            className="rounded-lg p-1.5 text-suave transition-colors hover:bg-elevada hover:text-tinta"
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

        {/* Avatar: clic abre Ajustes. Reemplaza la ruedita para que el
            destino "configuración" sea más natural (foto → perfil). */}
        <NavLink
          to="/ajustes"
          aria-label="Ajustes"
          className="shrink-0 lg:hidden"
        >
          {usuario ? (
            <Avatar nombre={usuario.displayName || usuario.email} foto={usuario.fotoUrl} />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-elevada" />
          )}
        </NavLink>
      </div>
    </header>
  )
}

