import { useMemo, useState } from 'react'
import { Pencil, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { TipoMovimiento, Transaccion } from '@/dominio/tipos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFecha, rangoPeriodo } from '@/dominio/fechas'
import { totalPorTipo } from '@/dominio/presupuestos'
import { crearTransaccion, eliminarTransaccion } from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { FormularioMovimiento, METODOS } from '@/componentes/FormularioMovimiento'
import { Boton, Campo, Cifra, Entrada, Selector, Tarjeta, Vacio, clases } from '@/componentes/ui/Basicos'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import { Icono } from '@/componentes/ui/Icono'
import { ConfirmarBorrado } from '@/componentes/ui/Modal'
import { descargarMovimientosCSV } from '@/exportar/csv'

type FiltroTipo = 'todos' | TipoMovimiento

export function Movimientos() {
  const { transacciones, categorias, periodo, ajustes } = useFinanzas()
  const { mostrar } = useAvisos()

  const rango = rangoPeriodo(periodo)
  const [desde, setDesde] = useState(rango.inicio)
  const [hasta, setHasta] = useState(rango.fin)
  const [usaRangoPropio, setUsaRangoPropio] = useState(false)
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [categoriaId, setCategoriaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)
  const [editando, setEditando] = useState<Transaccion | undefined>()
  const [borrando, setBorrando] = useState<Transaccion | undefined>()

  // Sin rango propio, la lista sigue al mes elegido en el encabezado.
  const inicio = usaRangoPropio ? desde : rango.inicio
  const fin = usaRangoPropio ? hasta : rango.fin

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const porId = new Map(categorias.map((c) => [c.id, c.nombre.toLowerCase()]))
    return transacciones
      .filter((t) => t.fecha >= inicio && t.fecha <= fin)
      .filter((t) => tipo === 'todos' || t.tipo === tipo)
      .filter((t) => categoriaId === '' || t.categoriaId === categoriaId)
      .filter(
        (t) =>
          texto === '' ||
          t.nota.toLowerCase().includes(texto) ||
          (porId.get(t.categoriaId) ?? '').includes(texto),
      )
      .sort((a, b) => (a.fecha === b.fecha ? b.creadoEn.localeCompare(a.creadoEn) : b.fecha.localeCompare(a.fecha)))
  }, [transacciones, categorias, inicio, fin, tipo, categoriaId, busqueda])

  const porDia = useMemo(() => {
    const grupos = new Map<string, Transaccion[]>()
    for (const t of filtradas) {
      const lista = grupos.get(t.fecha) ?? []
      lista.push(t)
      grupos.set(t.fecha, lista)
    }
    return [...grupos.entries()]
  }, [filtradas])

  const ingresos = totalPorTipo(filtradas, 'ingreso')
  const egresos = totalPorTipo(filtradas, 'egreso')
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: false })

  async function borrar(t: Transaccion) {
    await eliminarTransaccion(t.id)
    mostrar('Movimiento eliminado', 'info', () => {
      void crearTransaccion({
        tipo: t.tipo,
        monto: t.monto,
        categoriaId: t.categoriaId,
        fecha: t.fecha,
        metodoPago: t.metodoPago,
        nota: t.nota,
      })
    })
  }

  return (
    <div className="space-y-4">
      {/* Tres montos en fila: a 320 px el padding de tarjeta por omisión deja
          56 px de contenido y un monto de cinco dígitos no cabe. Aquí el
          espaciado cede y vuelve a lo normal en cuanto hay ancho. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tarjeta className="px-2.5 py-3 sm:px-4">
          <Cifra etiqueta="Ingresos" valor={dinero(ingresos)} tamano="cifra-lg" />
        </Tarjeta>
        <Tarjeta className="px-2.5 py-3 sm:px-4">
          <Cifra etiqueta="Egresos" valor={dinero(egresos)} tamano="cifra-lg" />
        </Tarjeta>
        <Tarjeta className="px-2.5 py-3 sm:px-4">
          <Cifra
            etiqueta="Neto"
            valor={dinero(ingresos - egresos)}
            tamano="cifra-lg"
            tono={ingresos - egresos >= 0 ? 'text-verde' : 'text-rojo'}
          />
        </Tarjeta>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" aria-hidden />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nota o categoría"
            className="pl-9"
            aria-label="Buscar movimientos"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltrosVisibles((v) => !v)}
          aria-expanded={filtrosVisibles}
          className={clases(
            'rounded-campo border px-3.5 transition-colors',
            filtrosVisibles ? 'border-acento bg-acento-suave text-acento' : 'border-borde bg-elevada text-suave hover:text-tinta',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="sr-only">Filtros</span>
        </button>
      </div>

      {filtrosVisibles && (
        <Tarjeta className="animar-entrada grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo">
            <Selector value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)}>
              <option value="todos">Todos</option>
              <option value="egreso">Solo gastos</option>
              <option value="ingreso">Solo ingresos</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Categoría">
            <Selector value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Desde">
            <CampoFecha
              valor={inicio}
              locale={ajustes.locale}
              onCambio={(f) => {
                setDesde(f)
                setUsaRangoPropio(true)
              }}
            />
          </Campo>
          <Campo etiqueta="Hasta">
            <CampoFecha
              valor={fin}
              locale={ajustes.locale}
              onCambio={(f) => {
                setHasta(f)
                setUsaRangoPropio(true)
              }}
            />
          </Campo>
          <div className="flex gap-2 sm:col-span-2">
            {usaRangoPropio && (
              <Boton
                variante="fantasma"
                onClick={() => {
                  setUsaRangoPropio(false)
                  setDesde(rango.inicio)
                  setHasta(rango.fin)
                }}
              >
                Volver al mes
              </Boton>
            )}
            <Boton
              variante="secundario"
              className="ml-auto"
              disabled={filtradas.length === 0}
              onClick={() => {
                descargarMovimientosCSV(filtradas, categorias, `movimientos-${inicio}_${fin}`)
                mostrar('CSV descargado')
              }}
            >
              Exportar CSV
            </Boton>
          </div>
        </Tarjeta>
      )}

      {filtradas.length === 0 ? (
        <Vacio
          titulo="Nada por aquí"
          descripcion="No hay movimientos con esos filtros. Prueba a ampliar el rango de fechas o registra el primero con el botón +."
        />
      ) : (
        <div className="space-y-4">
          {porDia.map(([fecha, movimientos]) => (
            <section key={fecha}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-xs font-medium tracking-wide text-suave uppercase">
                  {formatearFecha(fecha, ajustes.locale)}
                </h2>
                <span className="cifras text-xs text-tenue">
                  {dinero(totalPorTipo(movimientos, 'ingreso') - totalPorTipo(movimientos, 'egreso'))}
                </span>
              </div>
              <Tarjeta className="divide-y divide-borde p-0">
                {movimientos.map((t) => {
                  const categoria = categorias.find((c) => c.id === t.categoriaId)
                  const metodo = METODOS.find((m) => m.valor === t.metodoPago)?.etiqueta
                  return (
                    <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${categoria?.color ?? '#86868B'}1f` }}
                      >
                        <Icono
                          nombre={categoria?.icono ?? 'Ellipsis'}
                          className="size-4"
                          style={{ color: categoria?.color ?? '#86868B' }}
                          strokeWidth={1.75}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-tinta">{t.nota || (categoria?.nombre ?? 'Sin categoría')}</p>
                        <p className="truncate text-xs text-tenue">
                          {t.nota ? `${categoria?.nombre ?? 'Sin categoría'} · ` : ''}
                          {metodo}
                        </p>
                      </div>
                      <span
                        className={clases(
                          'cifras shrink-0 text-sm font-medium',
                          t.tipo === 'ingreso' ? 'text-verde' : 'text-tinta',
                        )}
                      >
                        {t.tipo === 'ingreso' ? '+' : '−'}
                        {formatearMoneda(t.monto, ajustes.moneda, ajustes.locale)}
                      </span>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditando(t)}
                          aria-label={`Editar movimiento de ${formatearMoneda(t.monto, ajustes.moneda, ajustes.locale)}`}
                          className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBorrando(t)}
                          aria-label={`Eliminar movimiento de ${formatearMoneda(t.monto, ajustes.moneda, ajustes.locale)}`}
                          className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </Tarjeta>
            </section>
          ))}
        </div>
      )}

      <FormularioMovimiento
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
        editando={editando}
        tipoInicial={editando?.tipo}
      />

      <ConfirmarBorrado
        abierto={borrando !== undefined}
        onCerrar={() => setBorrando(undefined)}
        onConfirmar={() => borrando && void borrar(borrando)}
        titulo="Eliminar movimiento"
        mensaje={
          borrando
            ? `Se elimina el ${borrando.tipo} de ${formatearMoneda(borrando.monto, ajustes.moneda, ajustes.locale)} del ${formatearFecha(borrando.fecha, ajustes.locale)}. Podrás deshacerlo desde el aviso.`
            : ''
        }
      />
    </div>
  )
}
