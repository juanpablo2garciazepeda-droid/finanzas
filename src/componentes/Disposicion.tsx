import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Plus,
  Receipt,
  Settings,
  Target,
  Wallet,
} from 'lucide-react'
import { nombrePeriodo, periodoActual, sumarMeses } from '@/dominio/fechas'
import { useFinanzas } from '@/estado/finanzas'
import { clases } from './ui/Basicos'
import { FormularioMovimiento } from './FormularioMovimiento'

const SECCIONES = [
  { ruta: '/', etiqueta: 'Tablero', Icono: LayoutDashboard },
  { ruta: '/movimientos', etiqueta: 'Movimientos', Icono: Receipt },
  { ruta: '/presupuestos', etiqueta: 'Presupuestos', Icono: Wallet },
  { ruta: '/deudas', etiqueta: 'Deudas', Icono: CreditCard },
  { ruta: '/metas', etiqueta: 'Metas', Icono: Target },
]

export function Disposicion({ children }: { children: ReactNode }) {
  const [registrando, setRegistrando] = useState(false)
  const { pathname } = useLocation()
  const enAjustes = pathname === '/ajustes'

  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-32 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {!enAjustes && (
        <button
          type="button"
          onClick={() => setRegistrando(true)}
          aria-label="Registrar movimiento"
          className="fixed right-5 bottom-24 z-30 flex size-14 items-center justify-center rounded-full bg-acento text-sobre-acento shadow-flotante transition-transform active:scale-95 lg:bottom-8"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Plus className="size-7" strokeWidth={2.25} aria-hidden />
        </button>
      )}

      <NavegacionMovil />

      <FormularioMovimiento abierto={registrando} onCerrar={() => setRegistrando(false)} />
    </div>
  )
}

function BarraLateral() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-6 lg:flex">
      <div className="px-3 pb-8">
        <MarcaApp />
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
        <Settings className="size-[18px]" strokeWidth={1.75} aria-hidden />
        Ajustes
      </NavLink>
    </aside>
  )
}

function NavegacionMovil() {
  return (
    <nav className="area-segura-inferior fixed inset-x-0 bottom-0 z-30 border-t border-borde cristal lg:hidden">
      <div className="mx-auto flex max-w-md">
        {SECCIONES.map(({ ruta, etiqueta, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            className={({ isActive }) =>
              clases(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-acento' : 'text-tenue',
              )
            }
          >
            <Icono className="size-[22px]" strokeWidth={1.75} aria-hidden />
            <span className="max-w-full truncate px-0.5">{etiqueta}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function MarcaApp({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-acento">
        <span className="cifras text-[15px] font-semibold text-sobre-acento">J</span>
      </span>
      {/* En pantallas angostas el logotipo cede el espacio al selector de mes. */}
      <span
        className={clases(
          'font-display text-[17px] font-semibold text-tinta',
          compacta && 'hidden sm:inline',
        )}
      >
        Juanpa Finanzas
      </span>
    </div>
  )
}

function Encabezado() {
  const { periodo, irAPeriodo, esPeriodoActual } = useFinanzas()

  return (
    <header className="sticky top-0 z-20 cristal border-b border-borde">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="lg:hidden">
          <MarcaApp compacta />
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

        <NavLink
          to="/ajustes"
          aria-label="Ajustes"
          className={({ isActive }) =>
            clases(
              'shrink-0 rounded-full bg-elevada p-2.5 transition-colors lg:hidden',
              isActive ? 'text-acento' : 'text-suave hover:text-tinta',
            )
          }
        >
          <Settings className="size-4" aria-hidden />
        </NavLink>
      </div>
    </header>
  )
}
