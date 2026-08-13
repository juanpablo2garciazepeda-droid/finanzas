import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type {
  Ajustes,
  AporteMeta,
  Categoria,
  Deuda,
  Meta,
  PagoDeuda,
  Presupuesto,
  Transaccion,
} from '@/dominio/tipos'
import type { ContextoFinanciero } from '@/dominio/alertas'
import { hoyISO, periodoActual } from '@/dominio/fechas'
import { AJUSTES_INICIALES, ID_AJUSTES, db } from '@/datos/db'
import { inicializar } from '@/datos/repositorio'

export interface EstadoFinanzas {
  cargando: boolean
  hoy: string
  /** Periodo que se está viendo. Puede no ser el mes en curso. */
  periodo: string
  irAPeriodo: (periodo: string) => void
  esPeriodoActual: boolean
  ajustes: Ajustes
  categorias: Categoria[]
  categoriasActivas: Categoria[]
  transacciones: Transaccion[]
  presupuestos: Presupuesto[]
  deudas: Deuda[]
  pagos: PagoDeuda[]
  metas: Meta[]
  aportes: AporteMeta[]
  /** Lo que consume la capa de dominio. */
  ctx: ContextoFinanciero
  hayMovimientos: boolean
  /**
   * Si la app tiene algo que mostrar. No basta con mirar los movimientos:
   * quien ya cargó sus deudas y su sueldo no debe seguir viendo la pantalla
   * de bienvenida como si no hubiera hecho nada.
   */
  hayDatos: boolean
}

const Contexto = createContext<EstadoFinanzas | null>(null)

export function ProveedorFinanzas({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false)
  const [periodo, setPeriodo] = useState(periodoActual)
  const [hoy, setHoy] = useState(hoyISO)

  useEffect(() => {
    inicializar().then(() => setListo(true))
  }, [])

  // Si la app se queda abierta cruzando la medianoche, "hoy" tiene que moverse.
  useEffect(() => {
    const id = setInterval(() => {
      const actual = hoyISO()
      setHoy((previo) => (previo === actual ? previo : actual))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const datos = useLiveQuery(async () => {
    const [ajustes, categorias, transacciones, presupuestos, deudas, pagos, metas, aportes] =
      await Promise.all([
        db.ajustes.get(ID_AJUSTES),
        db.categorias.orderBy('orden').toArray(),
        db.transacciones.toArray(),
        db.presupuestos.toArray(),
        db.deudas.toArray(),
        db.pagosDeuda.toArray(),
        db.metas.orderBy('prioridad').toArray(),
        db.aportesMeta.toArray(),
      ])
    return { ajustes, categorias, transacciones, presupuestos, deudas, pagos, metas, aportes }
  }, [listo])

  const valor = useMemo<EstadoFinanzas>(() => {
    const ajustes = datos?.ajustes ?? AJUSTES_INICIALES
    const categorias = datos?.categorias ?? []
    const transacciones = datos?.transacciones ?? []
    const presupuestos = datos?.presupuestos ?? []
    const deudas = datos?.deudas ?? []
    const metas = datos?.metas ?? []
    const aportes = datos?.aportes ?? []

    return {
      cargando: !listo || datos === undefined,
      hoy,
      periodo,
      irAPeriodo: setPeriodo,
      esPeriodoActual: periodo === periodoActual(),
      ajustes,
      categorias,
      categoriasActivas: categorias.filter((c) => !c.archivada),
      transacciones,
      presupuestos,
      deudas,
      pagos: datos?.pagos ?? [],
      metas,
      aportes,
      ctx: {
        hoy,
        periodo,
        ajustes,
        categorias,
        transacciones,
        presupuestos,
        deudas,
        pagos: datos?.pagos ?? [],
        metas,
        aportes,
      },
      hayMovimientos: transacciones.length > 0,
      hayDatos:
        transacciones.length > 0 ||
        deudas.length > 0 ||
        metas.length > 0 ||
        presupuestos.length > 0 ||
        ajustes.ingresoMensual > 0 ||
        ajustes.saldoInicial > 0,
    }
  }, [datos, listo, periodo, hoy])

  return <Contexto value={valor}>{children}</Contexto>
}

export function useFinanzas(): EstadoFinanzas {
  const valor = use(Contexto)
  if (!valor) throw new Error('useFinanzas necesita estar dentro de ProveedorFinanzas')
  return valor
}

/** Formateadores atados a la moneda y el locale configurados. */
export function useFormato() {
  const { ajustes } = useFinanzas()
  return useMemo(() => ({ moneda: ajustes.moneda, locale: ajustes.locale }), [ajustes])
}
