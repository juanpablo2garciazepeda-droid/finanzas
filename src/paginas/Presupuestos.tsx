import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Minus, Plus } from 'lucide-react'
import { aCentavos, formatearMoneda, formatearPorcentaje } from '@/dominio/dinero'
import { nombrePeriodo, periodoAnterior } from '@/dominio/fechas'
import {
  calcularEstados,
  compararPeriodos,
  presupuestosDelPeriodo,
  transaccionesDelPeriodo,
} from '@/dominio/presupuestos'
import { copiarPresupuestos, fijarPresupuesto } from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import {
  Barra,
  Boton,
  Campo,
  EntradaMoneda,
  Insignia,
  Tarjeta,
  TituloSeccion,
  Vacio,
  clases,
} from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
import { Modal } from '@/componentes/ui/Modal'

export function Presupuestos() {
  const { ctx, categoriasActivas, presupuestos, transacciones, periodo, ajustes, refrescar } =
    useFinanzas()
  const { mostrar } = useAvisos()
  const [editando, setEditando] = useState<{ categoriaId: string | null; nombre: string; limite: number } | null>(null)

  const delPeriodo = useMemo(() => transaccionesDelPeriodo(transacciones, periodo), [transacciones, periodo])
  const vigentes = useMemo(() => presupuestosDelPeriodo(presupuestos, periodo), [presupuestos, periodo])

  const estados = useMemo(
    () => calcularEstados(vigentes, delPeriodo, ctx.categorias, ajustes.umbralPrecaucion),
    [vigentes, delPeriodo, ctx.categorias, ajustes.umbralPrecaucion],
  )
  const global = estados.find((e) => e.categoriaId === null)
  const porCategoria = estados.filter((e) => e.categoriaId !== null)

  const anterior = periodoAnterior(periodo)
  const comparativa = useMemo(
    () =>
      compararPeriodos(delPeriodo, transaccionesDelPeriodo(transacciones, anterior), ctx.categorias).slice(0, 6),
    [delPeriodo, transacciones, anterior, ctx.categorias],
  )

  const sinPresupuesto = categoriasActivas.filter(
    (c) => c.tipo === 'egreso' && !vigentes.some((p) => p.categoriaId === c.id),
  )

  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })

  async function copiar() {
    const copiados = await copiarPresupuestos(anterior, periodo)
    await refrescar()
    mostrar(
      copiados > 0
        ? `Copié ${copiados} ${copiados === 1 ? 'presupuesto' : 'presupuestos'} de ${nombrePeriodo(anterior)}`
        : `No hay presupuestos nuevos que copiar de ${nombrePeriodo(anterior)}`,
      copiados > 0 ? 'exito' : 'info',
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <TituloSeccion
          accion={
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex items-center gap-1.5 text-xs text-acento hover:underline"
            >
              <Copy className="size-3" aria-hidden />
              Copiar del mes pasado
            </button>
          }
        >
          Tope de {nombrePeriodo(periodo)}
        </TituloSeccion>

        <Tarjeta>
          {global ? (
            <button
              type="button"
              onClick={() => setEditando({ categoriaId: null, nombre: 'Todo el mes', limite: global.limite })}
              className="w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="cifras text-2xl font-semibold text-tinta">{dinero(global.gastado)}</span>
                <span className="text-sm text-suave">de {dinero(global.limite)}</span>
              </div>
              <Barra fraccion={global.consumo} nivel={global.nivel} alto="h-2.5" etiqueta="Gasto total del mes" />
              <p className="mt-2 text-xs text-tenue">
                {global.restante >= 0
                  ? `Te quedan ${dinero(global.restante)} para todo el mes.`
                  : `Te pasaste ${dinero(-global.restante)} del tope.`}
              </p>
            </button>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-suave">
                Sin un tope general no hay contra qué medir el mes completo. Es el número que más pesa en el
                semáforo.
              </p>
              <Boton
                variante="secundario"
                onClick={() => setEditando({ categoriaId: null, nombre: 'Todo el mes', limite: 0 })}
              >
                <Plus className="size-4" aria-hidden />
                Poner un tope mensual
              </Boton>
            </div>
          )}
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Por categoría</TituloSeccion>
        {porCategoria.length === 0 ? (
          <Vacio
            titulo="Aún no pones límites"
            descripcion="Define cuánto quieres gastar como máximo en cada categoría. Es lo que convierte el semáforo en algo útil."
          />
        ) : (
          <div className="space-y-2">
            {porCategoria.map((estado) => (
              <button
                key={estado.categoriaId}
                type="button"
                onClick={() =>
                  setEditando({ categoriaId: estado.categoriaId, nombre: estado.nombre, limite: estado.limite })
                }
                className="block w-full rounded-tarjeta bg-superficie p-4 text-left shadow-tarjeta transition-shadow hover:shadow-flotante"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${estado.color}1f` }}
                  >
                    <Icono nombre={estado.icono} className="size-3.5" style={{ color: estado.color }} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{estado.nombre}</span>
                  <span className="cifras text-sm text-tinta">{dinero(estado.gastado)}</span>
                  <span className="text-xs text-tenue">/ {dinero(estado.limite)}</span>
                </div>
                <Barra fraccion={estado.consumo} nivel={estado.nivel} color={estado.nivel === 'verde' ? estado.color : undefined} etiqueta={`Presupuesto de ${estado.nombre}`} />
                <p className="mt-1.5 text-xs text-tenue">
                  {estado.restante >= 0
                    ? `Quedan ${dinero(estado.restante)} · ${formatearPorcentaje(estado.consumo, ajustes.locale)} usado`
                    : `Rebasado por ${dinero(-estado.restante)}`}
                </p>
              </button>
            ))}
          </div>
        )}

        {sinPresupuesto.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sinPresupuesto.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditando({ categoriaId: c.id, nombre: c.nombre, limite: 0 })}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-borde px-3 py-1.5 text-xs text-suave transition-colors hover:border-acento hover:text-acento"
              >
                <Plus className="size-3" aria-hidden />
                {c.nombre}
              </button>
            ))}
          </div>
        )}
      </section>

      {comparativa.length > 0 && (
        <section>
          <TituloSeccion>Contra {nombrePeriodo(anterior)}</TituloSeccion>
          <Tarjeta className="divide-y divide-borde p-0">
            {comparativa.map((fila) => {
              // Menos de medio punto porcentual es "igual": una flecha verde
              // junto a un 0% dice que algo mejoró cuando no cambió nada.
              const igual = fila.variacion !== null && Math.abs(fila.variacion) < 0.005
              const sube = (fila.variacion ?? 0) > 0
              const Flecha = fila.variacion === null || igual ? Minus : sube ? ArrowUp : ArrowDown
              return (
                <div key={fila.categoriaId} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${fila.color}1f` }}
                  >
                    <Icono nombre={fila.icono} className="size-3.5" style={{ color: fila.color }} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{fila.nombre}</span>
                  <span className="cifras text-sm text-tinta">{dinero(fila.actual)}</span>
                  <Insignia
                    nivel={fila.variacion === null || igual ? undefined : sube ? 'rojo' : 'verde'}
                    neutra={fila.variacion === null || igual}
                  >
                    <Flecha className="size-3" aria-hidden />
                    {fila.variacion === null
                      ? 'nuevo'
                      : igual
                        ? 'igual'
                        : formatearPorcentaje(Math.abs(fila.variacion), ajustes.locale)}
                  </Insignia>
                </div>
              )
            })}
          </Tarjeta>
        </section>
      )}

      {/* Se monta al abrirse para que no arrastre el límite de la categoría
          que se editó antes. */}
      {editando && (
        <EditorPresupuesto
          editando={editando}
          periodo={periodo}
          onCerrar={() => setEditando(null)}
          onGuardado={(nombre, limite) =>
            mostrar(limite > 0 ? `Presupuesto de ${nombre} actualizado` : `Quité el presupuesto de ${nombre}`)
          }
        />
      )}
    </div>
  )
}

function EditorPresupuesto({
  editando,
  periodo,
  onCerrar,
  onGuardado,
}: {
  editando: { categoriaId: string | null; nombre: string; limite: number }
  periodo: string
  onCerrar: () => void
  onGuardado: (nombre: string, limite: number) => void
}) {
  const { refrescar } = useFinanzas()
  const [monto, setMonto] = useState(editando.limite > 0 ? String(editando.limite / 100) : '')

  async function guardar() {
    const centavos = aCentavos(monto)
    await fijarPresupuesto(editando.categoriaId, periodo, centavos)
    await refrescar()
    onGuardado(editando.nombre, centavos)
    onCerrar()
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={editando.nombre}
      descripcion={`Límite para ${nombrePeriodo(periodo)}`}
      ancho="sm:max-w-sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <Campo etiqueta="Límite" ayuda="Déjalo en cero para quitar el presupuesto" htmlFor="limite">
          <EntradaMoneda
            id="limite"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className={clases('cifras text-lg')}
          />
        </Campo>
        <Boton type="submit" ancho>
          Guardar
        </Boton>
      </form>
    </Modal>
  )
}
