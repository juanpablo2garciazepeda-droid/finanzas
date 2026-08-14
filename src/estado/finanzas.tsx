import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { cargarTodo, guardarAjustes as guardarAjustesApi } from '@/datos/repositorio'

export interface EstadoFinanzas {
  cargando: boolean
  error: string | null
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
  /** Vuelve a traer todo del backend. Útil tras una mutación. */
  refrescar: () => Promise<void>
  /**
   * Guarda cambios en los ajustes y actualiza el estado local de inmediato
   * (sin refetch). Esto es clave para `tema` y `acento`: el `useEffect`
   * que pinta el tema necesita ver el nuevo valor en el siguiente render,
   * si no, el cambio solo se aplica al recargar la página.
   */
  guardarAjustes: (cambios: Partial<Ajustes>) => Promise<void>
}

const Contexto = createContext<EstadoFinanzas | null>(null)

export function ProveedorFinanzas({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof cargarTodo>> | null>(null)
  const [periodo, setPeriodo] = useState(periodoActual)
  const [hoy, setHoy] = useState(hoyISO)

  const refrescar = useCallback(async () => {
    try {
      const r = await cargarTodo()
      setDatos(r)
      setError(null)
    } catch (e) {
      // Clave: NO se toca `datos`. Si ya había deudas y movimientos en
      // pantalla, se quedan; lo único que cambia es que aparece el aviso de
      // que no se pudo sincronizar. Borrarlos ante un fallo de red hacía que
      // una caída momentánea se viviera como "se borró todo".
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos')
      throw e
    }
  }, [])

  // `guardarAjustes` necesita el valor más reciente de ajustes sin esperar a
  // que el `useCallback` de abajo se vuelva a crear (tiene deps `[]` a
  // propósito, para que su identidad no cambie en cada dato que llega).
  const ajustesRef = useRef<Ajustes>(ajustesPorDefecto())
  ajustesRef.current = datos?.ajustes ?? ajustesPorDefecto()

  const guardarAjustes = useCallback(async (cambios: Partial<Ajustes>) => {
    const anterior = ajustesRef.current
    const optimista: Ajustes = { ...anterior, ...cambios }

    // Se aplica de inmediato, antes de esperar la red: elegir tema o acento
    // tiene que sentirse instantáneo, no depender de cuánto tarde el
    // servidor en responder. Si la petición falla, se revierte más abajo.
    aplicarApariencia(optimista)
    setDatos((prev) => (prev ? { ...prev, ajustes: optimista } : prev))

    try {
      const nuevos = await guardarAjustesApi(cambios)
      aplicarApariencia(nuevos)
      setDatos((prev) => (prev ? { ...prev, ajustes: nuevos } : prev))
    } catch (err) {
      aplicarApariencia(anterior)
      setDatos((prev) => (prev ? { ...prev, ajustes: anterior } : prev))
      throw err
    }
  }, [])

  useEffect(() => {
    refrescar()
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))
      .finally(() => setListo(true))
  }, [refrescar])

  // Si la app se queda abierta cruzando la medianoche, "hoy" tiene que moverse.
  useEffect(() => {
    const id = setInterval(() => {
      const actual = hoyISO()
      setHoy((previo) => (previo === actual ? previo : actual))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const valor = useMemo<EstadoFinanzas>(() => {
    const ajustes = datos?.ajustes ?? ajustesPorDefecto()
    const categorias = datos?.categorias ?? []
    const transacciones = datos?.transacciones ?? []
    const presupuestos = datos?.presupuestos ?? []
    const deudas = datos?.deudas ?? []
    const metas = datos?.metas ?? []
    const aportes = datos?.aportes ?? []
    const pagos = datos?.pagos ?? []

    return {
      cargando: !listo,
      error,
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
      pagos,
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
        pagos,
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
      refrescar,
      guardarAjustes,
    }
  }, [datos, listo, error, periodo, hoy, refrescar, guardarAjustes])

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

/**
 * Aplica tema y acento al DOM de inmediato, sin esperar a que el `useEffect`
 * de `useAplicarApariencia` dispare en el siguiente render. Esto garantiza
 * que cambiar tema se vea al instante en cualquier parte de la app, no solo
 * en componentes que re-renderizan por el cambio de contexto.
 */
function aplicarApariencia(ajustes: Ajustes): void {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  if (ajustes.tema === 'sistema') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', ajustes.tema)
  raiz.setAttribute('data-acento', ajustes.acento)
  try {
    localStorage.setItem('finanzas.tema', ajustes.tema)
    localStorage.setItem('finanzas.acento', ajustes.acento)
  } catch {
    // localStorage puede no estar disponible; el tema igual queda
    // en la sesión actual por el atributo del DOM.
  }
}

function ajustesPorDefecto(): Ajustes {
  return {
    id: 'unico',
    moneda: 'MXN',
    locale: 'es-MX',
    ingresoMensual: 0,
    cicloPago: 'quincenal',
    saldoInicial: 0,
    saldoInicialFecha: '',
    tema: 'sistema',
    acento: 'grafito',
    diasAvisoVencimiento: 7,
    umbralPrecaucion: 0.8,
    notificacionesActivas: false,
    ultimaRevisionVencimientos: '',
  }
}
