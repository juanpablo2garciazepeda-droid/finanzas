import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { Meta } from '@/dominio/tipos'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { formatearFecha, hoyISO, mesesEntre, nombrePeriodo, periodoDe, sumarMeses } from '@/dominio/fechas'
import { ahorroTotal, aportesDeMeta, proyectarMeta } from '@/dominio/metas'
import {
  actualizarMeta,
  crearMeta,
  eliminarAporte,
  eliminarMeta,
  registrarAporte,
  reordenarMetas,
} from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import {
  Barra,
  Boton,
  Campo,
  Cifra,
  Entrada,
  EntradaMoneda,
  Insignia,
  Tarjeta,
  TituloSeccion,
  Vacio,
  clases,
} from '@/componentes/ui/Basicos'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import { Icono } from '@/componentes/ui/Icono'
import { SelectorIcono } from '@/componentes/ui/Selectores'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'

export function Metas() {
  const { metas, aportes, ajustes, hoy, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Meta | undefined>()
  const [aportando, setAportando] = useState<Meta | undefined>()
  const [detalle, setDetalle] = useState<Meta | undefined>()
  const [borrando, setBorrando] = useState<Meta | undefined>()

  const activas = metas.filter((m) => !m.completada)
  const completadas = metas.filter((m) => m.completada)
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })
  const aporteMensualTotal = activas.reduce((total, m) => total + m.aporteMensual, 0)

  async function mover(meta: Meta, direccion: -1 | 1) {
    const orden = activas.map((m) => m.id)
    const indice = orden.indexOf(meta.id)
    const destino = indice + direccion
    if (destino < 0 || destino >= orden.length) return
    ;[orden[indice], orden[destino]] = [orden[destino], orden[indice]]
    await reordenarMetas([...orden, ...completadas.map((m) => m.id)])
    await refrescar()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Tarjeta>
          <Cifra
            etiqueta="Ahorro total"
            valor={dinero(ahorroTotal(metas))}
            detalle={`${activas.length} metas activas`}
          />
        </Tarjeta>
        <Tarjeta>
          <Cifra
            etiqueta="Apartas al mes"
            valor={dinero(aporteMensualTotal)}
            detalle="para cumplir tus plazos"
          />
        </Tarjeta>
      </div>

      <section>
        <TituloSeccion
          accion={
            <Boton variante="secundario" onClick={() => setCreando(true)} className="px-4 py-2 text-[15px]">
              <Plus className="size-4" aria-hidden />
              Nueva meta
            </Boton>
          }
        >
          En curso
        </TituloSeccion>

        {activas.length === 0 ? (
          <Vacio
            titulo="Sin metas de ahorro"
            descripcion="Dime qué quieres juntar y para cuándo; yo calculo cuánto tienes que apartar cada mes."
            accion={
              <Boton variante="secundario" onClick={() => setCreando(true)}>
                Crear la primera
              </Boton>
            }
          />
        ) : (
          <div className="space-y-3">
            {activas.map((meta, indice) => {
              const proyeccion = proyectarMeta(meta, aportes, hoy)
              return (
                <Tarjeta key={meta.id}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento-suave">
                      <Icono nombre={meta.icono} className="size-[18px] text-acento" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-display text-[17px] font-semibold text-tinta">
                          {meta.nombre}
                        </h3>
                        {proyeccion.enRiesgo && (
                          <Insignia nivel={proyeccion.vencida ? 'rojo' : 'ambar'}>
                            {proyeccion.vencida ? 'Vencida' : 'En riesgo'}
                          </Insignia>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-tenue">
                        Para el {formatearFecha(meta.fechaLimite, ajustes.locale)} · apartas{' '}
                        {dinero(meta.aporteMensual)} al mes
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => void mover(meta, -1)}
                        disabled={indice === 0}
                        aria-label={`Subir prioridad de ${meta.nombre}`}
                        className="rounded p-0.5 text-tenue transition-colors hover:text-tinta disabled:opacity-25"
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void mover(meta, 1)}
                        disabled={indice === activas.length - 1}
                        aria-label={`Bajar prioridad de ${meta.nombre}`}
                        className="rounded p-0.5 text-tenue transition-colors hover:text-tinta disabled:opacity-25"
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="cifras text-[22px] font-semibold text-tinta">
                      {dinero(meta.montoActual)}
                    </span>
                    <span className="text-[15px] text-suave">de {dinero(meta.montoObjetivo)}</span>
                  </div>
                  <div className="mt-1.5">
                    <Barra fraccion={proyeccion.avance} color="#0F84D8" etiqueta={`Avance de ${meta.nombre}`} />
                  </div>

                  <p className="mt-2 text-[13px] leading-relaxed text-suave">
                    {proyeccion.faltante === 0 ? (
                      '¡Objetivo alcanzado!'
                    ) : proyeccion.periodoProyectado ? (
                      <>
                        A este ritmo llegas en{' '}
                        <span className="text-tinta">{nombrePeriodo(proyeccion.periodoProyectado)}</span>.
                        {proyeccion.enRiesgo &&
                          ` Para cumplir la fecha necesitas ${dinero(proyeccion.aporteNecesario)} al mes.`}
                      </>
                    ) : (
                      `Te faltan ${dinero(proyeccion.faltante)}. Ajusta la fecha límite para fijar un ritmo.`
                    )}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Boton onClick={() => setAportando(meta)} className="flex-1">
                      Aportar
                    </Boton>
                    <Boton variante="secundario" onClick={() => setDetalle(meta)}>
                      Historial
                    </Boton>
                    <Boton variante="secundario" onClick={() => setEditando(meta)}>
                      Editar
                    </Boton>
                    <button
                      type="button"
                      onClick={() => setBorrando(meta)}
                      aria-label={`Eliminar ${meta.nombre}`}
                      className="rounded-full px-3 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                    >
                      <Trash2 className="size-[18px]" aria-hidden />
                    </button>
                  </div>
                </Tarjeta>
              )
            })}
          </div>
        )}
      </section>

      {completadas.length > 0 && (
        <section>
          <TituloSeccion>Cumplidas</TituloSeccion>
          <Tarjeta className="divide-y divide-borde p-0">
            {completadas.map((meta) => (
              <div key={meta.id} className="flex items-center gap-3 px-4 py-3">
                <Insignia nivel="verde">Lograda</Insignia>
                <span className="min-w-0 flex-1 truncate text-[15px] text-suave">{meta.nombre}</span>
                <span className="cifras text-[15px] text-tenue">{dinero(meta.montoActual)}</span>
                <button
                  type="button"
                  onClick={() => setBorrando(meta)}
                  aria-label={`Eliminar ${meta.nombre}`}
                  className="rounded-full p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}

      {(creando || editando) && (
        <FormularioMeta
          editando={editando}
          siguientePrioridad={metas.length + 1}
          onCerrar={() => {
            setCreando(false)
            setEditando(undefined)
          }}
        />
      )}

      {aportando && <FormularioAporte meta={aportando} onCerrar={() => setAportando(undefined)} />}

      {detalle && <HistorialAportes meta={detalle} onCerrar={() => setDetalle(undefined)} />}

      <ConfirmarBorrado
        abierto={borrando !== undefined}
        onCerrar={() => setBorrando(undefined)}
        onConfirmar={() => {
          if (!borrando) return
          void eliminarMeta(borrando.id)
            .then(() => refrescar())
            .then(() => mostrar(`Eliminé la meta ${borrando.nombre}`))
        }}
        titulo="Eliminar meta"
        mensaje={borrando ? `Se borran ${borrando.nombre} y todos sus aportes. Esto no se puede deshacer.` : ''}
      />
    </div>
  )
}

const PLAZOS_MESES = [3, 6, 12, 18, 24, 36]

function FormularioMeta({
  editando,
  siguientePrioridad,
  onCerrar,
}: {
  editando?: Meta
  siguientePrioridad: number
  onCerrar: () => void
}) {
  const { ajustes, hoy, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()

  const [nombre, setNombre] = useState(editando?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(editando ? String(editando.montoObjetivo / 100) : '')
  const [inicial, setInicial] = useState('')
  const [fechaLimite, setFechaLimite] = useState(
    editando?.fechaLimite ?? `${sumarMeses(periodoDe(hoy), 12)}-01`,
  )
  const [icono, setIcono] = useState(editando?.icono ?? 'PiggyBank')

  const montoObjetivo = aCentavos(objetivo)
  const yaAhorrado = editando ? editando.montoActual : aCentavos(inicial)
  const faltante = Math.max(0, montoObjetivo - yaAhorrado)

  // El plazo es lo que la persona decide; el aporte mensual se deduce de él.
  // Aquí se cuentan los meses completos que faltan y no se suma el mes en curso:
  // si eligió "12 meses", el resumen tiene que decir 12. Eso deja un aporte algo
  // más alto que el mínimo que exigirá `proyectarMeta`, y de más nunca sobra.
  const meses = Math.max(1, mesesEntre(hoy, fechaLimite))
  const aporteMensual = faltante === 0 ? 0 : Math.ceil(faltante / meses)

  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })
  const valido = nombre.trim() !== '' && montoObjetivo > 0

  function fijarPlazo(enMeses: number) {
    const destino = sumarMeses(periodoDe(hoy), enMeses)
    setFechaLimite(`${destino}-01`)
  }

  /** Marca el chip cuyo plazo coincide con la fecha elegida. */
  const mesesElegidos = mesesEntre(hoy, fechaLimite)

  async function guardar() {
    if (!valido) return
    const datos = {
      nombre: nombre.trim(),
      montoObjetivo,
      fechaLimite,
      aporteMensual,
      icono,
    }
    if (editando) {
      await actualizarMeta(editando.id, datos)
      await refrescar()
      mostrar(`Meta actualizada: apartas ${dinero(aporteMensual)} al mes`)
    } else {
      await crearMeta({ ...datos, prioridad: siguientePrioridad, montoActual: aCentavos(inicial) })
      await refrescar()
      mostrar(`Creé ${datos.nombre}: ${dinero(aporteMensual)} al mes`)
    }
    onCerrar()
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={editando ? 'Editar meta' : 'Nueva meta'}
      descripcion="Elige el plazo y yo calculo cuánto apartar cada mes."
      ancho="sm:max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-5"
      >
        <Campo etiqueta="Nombre" htmlFor="nombreMeta">
          <Entrada
            id="nombreMeta"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Fondo de emergencia"
            maxLength={60}
          />
        </Campo>

        <div>
          <label htmlFor="objetivo" className="mb-1.5 block text-[13px] font-medium text-suave">
            Cuánto quieres juntar
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <EntradaMoneda
              id="objetivo"
              base={false}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
        </div>

        {!editando && (
          <div className="max-w-xs">
            <Campo etiqueta="Ya tengo ahorrado" ayuda="Opcional" htmlFor="inicial">
              <EntradaMoneda
                id="inicial"
                value={inicial}
                onChange={(e) => setInicial(e.target.value)}
                placeholder="0.00"
                className="cifras"
              />
            </Campo>
          </div>
        )}

        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">¿Para cuándo lo quieres?</span>
          <div className="flex flex-wrap gap-2">
            {PLAZOS_MESES.map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={mesesElegidos === opcion}
                onClick={() => fijarPlazo(opcion)}
                className={clases(
                  'rounded-full px-4 py-2 text-[15px] transition-colors',
                  mesesElegidos === opcion
                    ? 'bg-acento text-sobre-acento'
                    : 'bg-elevada text-tinta hover:bg-hundida',
                )}
              >
                {opcion} meses
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <Campo etiqueta="O una fecha exacta" htmlFor="limiteMeta">
              <CampoFecha
                id="limiteMeta"
                valor={fechaLimite}
                min={hoy}
                onCambio={setFechaLimite}
                locale={ajustes.locale}
              />
            </Campo>
          </div>
        </div>

        {/* Va justo después de los datos que lo determinan: es la respuesta a
            la pregunta que de verdad importa, y no debe quedar bajo el pliegue. */}
        {montoObjetivo > 0 && (
          <div className="animar-entrada rounded-tarjeta bg-elevada p-4">
            <p className="text-[13px] text-suave">Para lograrlo necesitas apartar</p>
            <p className="cifras mt-0.5 text-[34px] leading-none font-semibold text-acento">
              {dinero(aporteMensual)}
            </p>
            <p className="mt-2 text-[15px] text-tinta">
              al mes durante <span className="cifras font-semibold">{meses}</span>{' '}
              {meses === 1 ? 'mes' : 'meses'}
              {yaAhorrado > 0 && `, contando los ${dinero(yaAhorrado)} que ya tienes`}.
            </p>
          </div>
        )}

        <SelectorIcono valor={icono} onCambio={setIcono} />

        <Boton type="submit" ancho disabled={!valido}>
          {editando ? 'Guardar cambios' : 'Crear meta'}
        </Boton>
      </form>
    </Modal>
  )
}

function FormularioAporte({ meta, onCerrar }: { meta: Meta; onCerrar: () => void }) {
  const { ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const [monto, setMonto] = useState(meta.aporteMensual > 0 ? String(meta.aporteMensual / 100) : '')
  const [fecha, setFecha] = useState(hoyISO)
  const [nota, setNota] = useState('')

  const centavos = aCentavos(monto)
  const faltante = Math.max(0, meta.montoObjetivo - meta.montoActual)

  async function guardar() {
    if (centavos <= 0) return
    await registrarAporte(meta.id, centavos, fecha, nota.trim())
    await refrescar()
    const nuevo = meta.montoActual + centavos
    mostrar(
      nuevo >= meta.montoObjetivo
        ? `¡Alcanzaste ${meta.nombre}!`
        : `Aporte registrado. Llevas ${formatearMoneda(nuevo, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })}`,
    )
    onCerrar()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Aportar a la meta" descripcion={meta.nombre} ancho="sm:max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="aporte" className="mb-1.5 block text-[13px] font-medium text-suave">
            Monto
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <EntradaMoneda
              id="aporte"
              base={false}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-[13px] text-tenue">
            Faltan {formatearMoneda(faltante, ajustes.moneda, ajustes.locale)}
          </p>
        </div>

        <Campo etiqueta="Fecha" htmlFor="fechaAporte">
          <CampoFecha id="fechaAporte" valor={fecha} onCambio={setFecha} locale={ajustes.locale} />
        </Campo>

        <Campo etiqueta="Nota" ayuda="Opcional" htmlFor="notaAporte">
          <Entrada id="notaAporte" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} />
        </Campo>

        <Boton type="submit" ancho disabled={centavos <= 0}>
          Registrar aporte
        </Boton>
      </form>
    </Modal>
  )
}

function HistorialAportes({ meta, onCerrar }: { meta: Meta; onCerrar: () => void }) {
  const { aportes, ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const mios = [...aportesDeMeta(aportes, meta.id)].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Historial de aportes" descripcion={meta.nombre} ancho="sm:max-w-md">
      {mios.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-tenue">Todavía no registras aportes a esta meta.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {mios.map((aporte) => (
            <li key={aporte.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-tinta">{formatearFecha(aporte.fecha, ajustes.locale)}</p>
                {aporte.nota && <p className="truncate text-[13px] text-tenue">{aporte.nota}</p>}
              </div>
              <span className="cifras text-[15px] font-medium text-tinta">
                {formatearMoneda(aporte.monto, ajustes.moneda, ajustes.locale)}
              </span>
              <button
                type="button"
                onClick={() => {
                  void eliminarAporte(aporte.id)
                    .then(() => refrescar())
                    .then(() => mostrar('Aporte eliminado y saldo recalculado', 'info'))
                }}
                aria-label="Eliminar aporte"
                className="rounded-full p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
