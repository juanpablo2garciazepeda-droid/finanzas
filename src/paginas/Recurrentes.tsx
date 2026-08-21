import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Plus, Trash2 } from 'lucide-react'
import { Boton, Campo, Entrada, EntradaMoneda, Selector, Tarjeta, TituloSeccion, clases } from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'
import { useFinanzas } from '@/estado/finanzas'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'
import {
  actualizarRecurrente,
  crearRecurrente,
  eliminarRecurrente,
  listarRecurrentes,
} from '@/datos/repositorio'
import { formatearMoneda } from '@/dominio/dinero'
import type { GastoRecurrente, MetodoPago, TipoMovimiento } from '@/dominio/tipos'

/**
 * Gestión de gastos/ingresos recurrentes.
 *
 * Cada plantilla se ejecuta al login del usuario: si el día del mes ya
 * pasó y la transacción del mes todavía no se generó, se inserta. La
 * marca `ultimoGeneradoEn` evita duplicar.
 */
export function Recurrentes() {
  const { categoriasActivas, ajustes, refrescar } = useFinanzas()
  const { usuario } = useAuth()
  const { mostrar } = useAvisos()
  const [lista, setLista] = useState<GastoRecurrente[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<GastoRecurrente | 'nuevo' | undefined>()
  const [borrando, setBorrando] = useState<GastoRecurrente | undefined>()

  useEffect(() => {
    void cargar()
  }, [usuario?.id])

  async function cargar() {
    setCargando(true)
    const r = await listarRecurrentes()
    setLista(r)
    setCargando(false)
  }

  async function alternarActivo(r: GastoRecurrente) {
    try {
      await actualizarRecurrente(r.id, { activo: !r.activo })
      mostrar(r.activo ? 'Pausado' : 'Activado')
      await cargar()
      await refrescar()
    } catch (err) {
      mostrar(err instanceof Error ? err.message : 'No se pudo actualizar', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/ajustes"
        className="inline-flex items-center gap-1.5 text-sm text-tenue transition-colors hover:text-tinta"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Ajustes
      </Link>
      <section>
        <TituloSeccion
          accion={
            <Boton
              variante="secundario"
              onClick={() => setEditando('nuevo')}
              className="px-4 py-2 text-[15px]"
            >
              <Plus className="size-4" aria-hidden />
              Nuevo recurrente
            </Boton>
          }
        >
          Gastos e ingresos recurrentes
        </TituloSeccion>
        <p className="mb-3 px-1 text-[13px] text-tenue">
          Netflix, la renta, el sueldo… se agregan solos el día que toca cada mes. Tú solo los creas
          una vez.
        </p>
        {cargando ? (
          <Tarjeta>
            <p className="text-[14px] text-suave">Cargando…</p>
          </Tarjeta>
        ) : lista.length === 0 ? (
          <Tarjeta>
            <p className="text-[14px] text-suave">
              Aún no tienes recurrentes. Crea uno con el botón de arriba.
            </p>
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-borde p-0">
            {lista.map((r) => {
              const cat = categoriasActivas.find((c) => c.id === r.categoriaId)
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${cat?.color ?? '#86868B'}1f` }}
                  >
                    <Icono
                      nombre={cat?.icono ?? 'Ellipsis'}
                      className="size-4"
                      style={{ color: cat?.color ?? '#86868B' }}
                      strokeWidth={1.75}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-tinta">
                      {cat?.nombre ?? 'Categoría'}
                    </p>
                    <p className="text-xs text-tenue">
                      Cada día {r.diaDelMes} ·{' '}
                      <span className={clases(!r.activo && 'line-through')}>
                        {r.activo ? 'activo' : 'pausado'}
                      </span>
                    </p>
                  </div>
                  <span
                    className={clases(
                      'cifras shrink-0 text-sm font-medium',
                      r.tipo === 'ingreso' ? 'text-verde' : 'text-tinta',
                    )}
                  >
                    {r.tipo === 'ingreso' ? '+' : '-'}
                    {formatearMoneda(r.monto, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarActivo(r)}
                    className="rounded-lg px-2 py-1 text-[12px] text-acento hover:bg-elevada"
                  >
                    {r.activo ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorrando(r)}
                    aria-label={`Eliminar ${cat?.nombre ?? 'recurrente'}`}
                    className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              )
            })}
          </Tarjeta>
        )}
      </section>

      {editando && (
        <EditorRecurrente
          inicial={editando === 'nuevo' ? undefined : editando}
          categorias={categoriasActivas}
          moneda={ajustes.moneda}
          locale={ajustes.locale}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async () => {
            await cargar()
            await refrescar()
            setEditando(undefined)
          }}
        />
      )}

      <ConfirmarBorrado
        abierto={borrando !== undefined}
        onCerrar={() => setBorrando(undefined)}
        onConfirmar={async () => {
          if (!borrando) return
          try {
            await eliminarRecurrente(borrando.id)
            mostrar('Eliminado')
            await cargar()
            await refrescar()
          } catch (err) {
            mostrar(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
          } finally {
            setBorrando(undefined)
          }
        }}
        titulo="Eliminar recurrente"
        mensaje="Las transacciones ya generadas se quedan; solo dejas de generar nuevas."
      />
    </div>
  )
}

function EditorRecurrente({
  inicial,
  categorias,
  moneda,
  locale,
  onCerrar,
  onGuardado,
}: {
  inicial?: GastoRecurrente
  categorias: { id: string; nombre: string; tipo: TipoMovimiento; archivada: boolean; icono: string; color: string }[]
  moneda: string
  locale: string
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
}) {
  const { mostrar } = useAvisos()
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? 'egreso')
  const [monto, setMonto] = useState<string>(
    inicial ? (inicial.monto / 100).toString() : '',
  )
  const [categoriaId, setCategoriaId] = useState<string>(inicial?.categoriaId ?? '')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(inicial?.metodoPago ?? 'debito')
  const [nota, setNota] = useState<string>(inicial?.nota ?? '')
  const [diaDelMes, setDiaDelMes] = useState<number>(inicial?.diaDelMes ?? 1)
  const [iniciaEn, setIniciaEn] = useState<string>(inicial?.iniciaEn ?? new Date().toISOString().slice(0, 10))
  const [terminaEn, setTerminaEn] = useState<string>(inicial?.terminaEn ?? '')
  const [guardando, setGuardando] = useState(false)

  const categoriasDelTipo = categorias.filter((c) => c.tipo === tipo)
  // Si la categoría seleccionada no encaja con el tipo, limpiarla.
  useEffect(() => {
    if (categoriaId && !categoriasDelTipo.some((c) => c.id === categoriaId)) {
      setCategoriaId(categoriasDelTipo[0]?.id ?? '')
    }
  }, [tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const montoCentavos = Math.round(Number(monto.replace(',', '.')) * 100)
  const listo =
    categoriasDelTipo.length > 0 &&
    categoriaId &&
    montoCentavos > 0 &&
    diaDelMes >= 1 &&
    diaDelMes <= 28 &&
    /^\d{4}-\d{2}-\d{2}$/.test(iniciaEn)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!listo) return
    setGuardando(true)
    try {
      const payload = {
        tipo,
        monto: montoCentavos,
        categoriaId,
        metodoPago,
        nota,
        diaDelMes,
        iniciaEn,
        terminaEn: terminaEn || null,
        activo: true,
      }
      if (inicial) {
        await actualizarRecurrente(inicial.id, payload)
      } else {
        await crearRecurrente(payload)
      }
      mostrar('Guardado')
      await onGuardado()
    } catch (err) {
      mostrar(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={inicial ? 'Editar recurrente' : 'Nuevo recurrente'}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Tipo" htmlFor="tipo">
          <Selector id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            <option value="egreso">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Monto" htmlFor="monto">
          <EntradaMoneda
            id="monto"
            type="text"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder={`Ej. ${(1234.56).toFixed(2)}`}
            required
            className="cifras"
          />
          {monto && (
            <p className="mt-1 text-[12px] text-tenue">
              ≈ {formatearMoneda(montoCentavos, moneda, locale, { conDecimales: 'auto' })}
            </p>
          )}
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="categoria">
          <Selector
            id="categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige una categoría
            </option>
            {categoriasDelTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Método de pago" htmlFor="metodo">
          <Selector
            id="metodo"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="transferencia">Transferencia</option>
            <option value="otro">Otro</option>
          </Selector>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Día del mes" htmlFor="dia">
            <Entrada
              id="dia"
              type="number"
              min={1}
              max={28}
              value={diaDelMes}
              onChange={(e) => setDiaDelMes(Math.max(1, Math.min(28, Number(e.target.value))))}
              required
            />
          </Campo>
          <Campo etiqueta="Empieza" htmlFor="inicia">
            <Entrada
              id="inicia"
              type="date"
              value={iniciaEn}
              onChange={(e) => setIniciaEn(e.target.value)}
              required
            />
          </Campo>
        </div>
        <Campo etiqueta="Termina (opcional)" htmlFor="termina">
          <Entrada
            id="termina"
            type="date"
            value={terminaEn}
            onChange={(e) => setTerminaEn(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Nota (opcional)" htmlFor="nota">
          <Entrada id="nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={140} />
        </Campo>
        <div className="rounded-campo bg-elevada p-3 text-[12px] text-suave">
          <Calendar className="mb-1 inline size-3.5" aria-hidden /> Se ejecuta al iniciar sesión
          cada mes; si el día ya pasó y no se generó, se inserta al toque.
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!listo || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
