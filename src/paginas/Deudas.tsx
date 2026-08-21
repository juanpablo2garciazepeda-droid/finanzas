import { useMemo, useState } from 'react'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import type { Deuda, Periodicidad } from '@/dominio/tipos'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import {
  fechaRelativa,
  formatearFecha,
  hoyISO,
  nombrePeriodo,
  pagosPorMes,
  periodoDe,
  siguienteOcurrencia,
  sumarMeses,
} from '@/dominio/fechas'
import {
  deudaTotal,
  obligacionMensual,
  pagosDeDeuda,
  planDePagos,
  proximosVencimientos,
  proyectarDeuda,
} from '@/dominio/deudas'
import {
  actualizarDeuda,
  crearDeuda,
  eliminarDeuda,
  eliminarPago,
  registrarPago,
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
  Selector,
  Tarjeta,
  TituloSeccion,
  Vacio,
  clases,
} from '@/componentes/ui/Basicos'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'
import { PERIODICIDAD } from '@/exportar/etiquetas'

export function Deudas() {
  const { deudas, pagos, ajustes, hoy, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Deuda | undefined>()
  const [abonando, setAbonando] = useState<Deuda | undefined>()
  const [detalle, setDetalle] = useState<Deuda | undefined>()
  const [borrando, setBorrando] = useState<Deuda | undefined>()

  const activas = deudas.filter((d) => !d.liquidada)
  const liquidadas = deudas.filter((d) => d.liquidada)
  const vencimientos = useMemo(() => proximosVencimientos(deudas, hoy, 30), [deudas, hoy])
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Tarjeta>
          <Cifra etiqueta="Deuda total" valor={dinero(deudaTotal(deudas))} detalle={`${activas.length} activas`} />
        </Tarjeta>
        <Tarjeta>
          {/* Lo que sale de tu bolsillo al mes, no el saldo: si debes 9,000 y
              abonas 1,000, tu compromiso del mes es 1,000. */}
          <Cifra
            etiqueta="Pagas al mes"
            valor={dinero(obligacionMensual(deudas))}
            detalle="suma de tus mensualidades"
          />
        </Tarjeta>
      </div>

      {vencimientos.length > 0 && (
        <section>
          <TituloSeccion>Por urgencia</TituloSeccion>
          <Tarjeta className="divide-y divide-borde p-0">
            {vencimientos.map((v) => (
              <button
                key={v.deuda.id}
                type="button"
                onClick={() => setAbonando(v.deuda)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-tarjeta last:rounded-b-tarjeta hover:bg-elevada"
              >
                <CalendarClock
                  className={clases(
                    'size-4 shrink-0',
                    v.vencido ? 'text-rojo' : v.dias <= 3 ? 'text-ambar' : 'text-tenue',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-tinta">{v.deuda.acreedor}</p>
                  <p className="text-[13px] text-tenue">
                    {formatearFecha(v.fecha, ajustes.locale)} · {fechaRelativa(hoy, v.fecha)}
                  </p>
                </div>
                <span className="cifras text-[15px] font-medium text-tinta">{dinero(v.monto)}</span>
              </button>
            ))}
          </Tarjeta>
        </section>
      )}

      <section>
        <TituloSeccion
          accion={
            <Boton variante="secundario" onClick={() => setCreando(true)} className="px-4 py-2 text-[15px]">
              <Plus className="size-4" aria-hidden />
              Agregar deuda
            </Boton>
          }
        >
          Tus deudas
        </TituloSeccion>

        {activas.length === 0 ? (
          <Vacio
            titulo="Sin deudas registradas"
            descripcion="Registra lo que debes para que el semáforo aparte ese dinero antes de decirte que puedes gastar."
            accion={
              <Boton variante="secundario" onClick={() => setCreando(true)}>
                Agregar la primera
              </Boton>
            }
          />
        ) : (
          <div className="space-y-3">
            {activas.map((deuda) => (
              <FichaDeuda
                key={deuda.id}
                deuda={deuda}
                proyeccion={proyectarDeuda(deuda, pagos, hoy)}
                onAbonar={() => setAbonando(deuda)}
                onEditar={() => setEditando(deuda)}
                onDetalle={() => setDetalle(deuda)}
                onBorrar={() => setBorrando(deuda)}
              />
            ))}
          </div>
        )}
      </section>

      {liquidadas.length > 0 && (
        <section>
          <TituloSeccion>Liquidadas</TituloSeccion>
          <Tarjeta className="divide-y divide-borde p-0">
            {liquidadas.map((deuda) => (
              <div key={deuda.id} className="flex items-center gap-3 px-4 py-3">
                <Insignia nivel="verde">Pagada</Insignia>
                <span className="min-w-0 flex-1 truncate text-[15px] text-suave">{deuda.acreedor}</span>
                <span className="cifras text-[15px] text-tenue">{dinero(deuda.montoOriginal)}</span>
                <button
                  type="button"
                  onClick={() => setBorrando(deuda)}
                  aria-label={`Eliminar ${deuda.acreedor}`}
                  className="rounded-full p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}

      {/* Los formularios se montan solo al abrirse: uno que sobrevive escondido
          conserva lo que se capturó la vez anterior y lo muestra al volver. */}
      {(creando || editando) && (
        <FormularioDeuda
          editando={editando}
          onCerrar={() => {
            setCreando(false)
            setEditando(undefined)
          }}
        />
      )}

      {abonando && <FormularioPago deuda={abonando} onCerrar={() => setAbonando(undefined)} />}

      {detalle && <HistorialPagos deuda={detalle} onCerrar={() => setDetalle(undefined)} />}

      <ConfirmarBorrado
        abierto={borrando !== undefined}
        onCerrar={() => setBorrando(undefined)}
        onConfirmar={() => {
          if (!borrando) return
          void eliminarDeuda(borrando.id)
            .then(() => refrescar())
            .then(() => mostrar(`Eliminé ${borrando.acreedor} y su historial de pagos`))
        }}
        titulo="Eliminar deuda"
        mensaje={
          borrando
            ? `Se borran ${borrando.acreedor} y todos sus abonos registrados. Esto no se puede deshacer.`
            : ''
        }
      />
    </div>
  )
}

function FichaDeuda({
  deuda,
  proyeccion,
  onAbonar,
  onEditar,
  onDetalle,
  onBorrar,
}: {
  deuda: Deuda
  proyeccion: ReturnType<typeof proyectarDeuda>
  onAbonar: () => void
  onEditar: () => void
  onDetalle: () => void
  onBorrar: () => void
}) {
  const { ajustes, hoy } = useFinanzas()
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })
  const proximo = siguienteOcurrencia(deuda.fechaLimite, deuda.periodicidad, hoy)
  const unidad = proyeccion.pagosRestantes === 1 ? 'pago' : 'pagos'

  return (
    <Tarjeta>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[17px] font-semibold text-tinta">{deuda.acreedor}</h3>
          <p className="mt-0.5 text-[13px] text-tenue">
            {PERIODICIDAD[deuda.periodicidad]}
            {deuda.tasaInteres ? ` · ${deuda.tasaInteres}% anual` : ''} · vence {fechaRelativa(hoy, proximo)}
          </p>
        </div>
        <div className="text-right">
          <p className="cifras text-[22px] font-semibold text-tinta">{dinero(deuda.saldoActual)}</p>
          <p className="text-[13px] text-tenue">de {dinero(deuda.montoOriginal)}</p>
        </div>
      </div>

      {/* Los tres números que se quieren de un vistazo: cuánto es cada pago,
          cuántos faltan y cuánto compromete al mes. */}
      {/* El padding cede en pantallas angostas: con px-3 fijo, la celda queda de
          61 px y ni la etiqueta ni el monto caben. */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-campo bg-borde">
        <div className="min-w-0 bg-elevada px-2 py-2.5 sm:px-3">
          <p className="etiqueta-celda text-tenue">Cada pago</p>
          <p className="cifras cifra-md mt-0.5 font-medium text-tinta">{dinero(deuda.pagoMinimo)}</p>
        </div>
        <div className="min-w-0 bg-elevada px-2 py-2.5 sm:px-3">
          <p className="etiqueta-celda text-tenue">Te faltan</p>
          <p className="cifras cifra-md mt-0.5 font-medium text-tinta">
            {proyeccion.pagosRestantes === null ? '—' : proyeccion.pagosRestantes}
            {proyeccion.pagosRestantes !== null && (
              <span className="etiqueta-celda ml-1 font-sans font-normal text-suave">{unidad}</span>
            )}
          </p>
        </div>
        <div className="min-w-0 bg-elevada px-2 py-2.5 sm:px-3">
          <p className="etiqueta-celda text-tenue">Compromiso</p>
          <p className="cifras cifra-md mt-0.5 font-medium text-tinta">
            {dinero(proyeccion.obligacionMensual)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Barra fraccion={proyeccion.avance} color="#10924B" etiqueta={`Avance de ${deuda.acreedor}`} />
        <p className="mt-2 text-[13px] leading-relaxed text-suave">
          {proyeccion.ahogada ? (
            <span className="text-rojo">
              Con {dinero(proyeccion.ritmoUsado)} al mes los intereses se comen el abono: el saldo no baja.
            </span>
          ) : proyeccion.periodoLiquidacion ? (
            <>
              Al ritmo real de {dinero(proyeccion.ritmoUsado)} al mes, la liquidas en{' '}
              <span className="text-tinta">{nombrePeriodo(proyeccion.periodoLiquidacion)}</span>
              {proyeccion.interesProyectado > 0 &&
                ` y pagarás ${dinero(proyeccion.interesProyectado)} de intereses`}
              .
            </>
          ) : (
            'Registra cuánto pagas por periodo para poder proyectar cuándo se liquida.'
          )}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Boton onClick={onAbonar} className="flex-1">
          Registrar abono
        </Boton>
        <Boton variante="secundario" onClick={onDetalle}>
          Historial
        </Boton>
        <Boton variante="secundario" onClick={onEditar}>
          Editar
        </Boton>
        <button
          type="button"
          onClick={onBorrar}
          aria-label={`Eliminar ${deuda.acreedor}`}
          className="rounded-full px-3 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
      </div>
    </Tarjeta>
  )
}

const PLAZOS_SUGERIDOS = [3, 6, 9, 12, 18, 24, 36, 48]

function FormularioDeuda({ editando, onCerrar }: { editando?: Deuda; onCerrar: () => void }) {
  const { ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()

  // El estado inicial vive en el propio useState. Como el componente se monta al
  // abrirse, nunca arrastra lo que se capturó en la deuda anterior.
  const [acreedor, setAcreedor] = useState(editando?.acreedor ?? '')
  const [montoOriginal, setMontoOriginal] = useState(editando ? String(editando.montoOriginal / 100) : '')
  const [tasaInteres, setTasaInteres] = useState(editando?.tasaInteres ? String(editando.tasaInteres) : '')
  const [fechaLimite, setFechaLimite] = useState(editando?.fechaLimite ?? hoyISO())
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(editando?.periodicidad ?? 'mensual')
  const [numeroPagos, setNumeroPagos] = useState(() =>
    editando && editando.pagoMinimo > 0
      ? String(Math.max(1, Math.ceil(editando.montoOriginal / editando.pagoMinimo)))
      : '12',
  )
  /** Si la persona escribe el pago a mano, deja de derivarse del plazo. */
  const [pagoManual, setPagoManual] = useState<string | null>(null)

  const monto = aCentavos(montoOriginal)
  const pagos = Math.max(0, Math.floor(Number(numeroPagos) || 0))
  const tasaCruda = tasaInteres.trim() === '' ? null : Number.parseFloat(tasaInteres)
  const tasa = tasaCruda !== null && Number.isFinite(tasaCruda) ? tasaCruda : null

  const plan = useMemo(() => planDePagos(monto, pagos, tasa, periodicidad), [monto, pagos, tasa, periodicidad])

  const porPago = pagoManual !== null ? aCentavos(pagoManual) : plan.porPago
  const porMes = pagosPorMes(periodicidad) || 1
  const mensual = Math.round(porPago * porMes)
  const pagosReales = porPago > 0 ? Math.ceil(monto / porPago) : 0
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })

  const unidad = periodicidad === 'mensual' ? 'mensualidades' : 'pagos'
  const valido = acreedor.trim() !== '' && monto > 0

  async function guardar() {
    if (!valido) return
    const datos = {
      acreedor: acreedor.trim(),
      montoOriginal: monto,
      tasaInteres: tasa,
      fechaLimite,
      periodicidad,
      pagoMinimo: porPago,
    }
    if (editando) {
      await actualizarDeuda(editando.id, datos)
      await refrescar()
      mostrar('Deuda actualizada')
    } else {
      await crearDeuda(datos)
      await refrescar()
      mostrar(`Registré ${datos.acreedor}: ${dinero(mensual)} al mes`)
    }
    onCerrar()
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={editando ? 'Editar deuda' : 'Nueva deuda'}
      descripcion="Dime cuánto debes y en cuántos pagos; yo calculo la mensualidad."
      ancho="sm:max-w-2xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-5"
      >
        <Campo etiqueta="A quién le debes" htmlFor="acreedor">
          <Entrada
            id="acreedor"
            value={acreedor}
            onChange={(e) => setAcreedor(e.target.value)}
            placeholder="Tarjeta BBVA"
            maxLength={60}
          />
        </Campo>

        <div>
          <label htmlFor="original" className="mb-1.5 block text-[13px] font-medium text-suave">
            Cuánto debes en total
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <EntradaMoneda
              id="original"
              base={false}
              value={montoOriginal}
              onChange={(e) => setMontoOriginal(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
        </div>

        {periodicidad !== 'unico' && (
          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">
              ¿En cuántos pagos lo liquidas?
            </span>
            <div className="flex flex-wrap gap-2">
              {PLAZOS_SUGERIDOS.map((opcion) => {
                const activo = pagos === opcion && pagoManual === null
                return (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      setNumeroPagos(String(opcion))
                      setPagoManual(null)
                    }}
                    className={clases(
                      'cifras rounded-full px-4 py-2 text-[15px] transition-colors',
                      activo ? 'bg-acento text-sobre-acento' : 'bg-elevada text-tinta hover:bg-hundida',
                    )}
                  >
                    {opcion}
                  </button>
                )
              })}
              {/* Vacío mientras haya un chip elegido: si no, el mismo número
                  aparece dos veces y parece que hay dos plazos activos. */}
              <input
                value={PLAZOS_SUGERIDOS.includes(pagos) ? '' : numeroPagos}
                onChange={(e) => {
                  setNumeroPagos(e.target.value.replace(/\D/g, ''))
                  setPagoManual(null)
                }}
                inputMode="numeric"
                aria-label="Otro número de pagos"
                placeholder="Otro"
                className="cifras w-20 rounded-full border border-borde bg-superficie px-4 py-2 text-center text-[15px] text-tinta focus:border-acento focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Periodicidad" htmlFor="periodicidad">
            <Selector
              id="periodicidad"
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}
            >
              {Object.entries(PERIODICIDAD).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Cuánto pagas cada vez"
            ayuda={pagoManual === null ? 'Calculado con el plazo que elegiste' : 'Lo pusiste tú'}
            htmlFor="porPago"
          >
            <EntradaMoneda
              id="porPago"
              value={pagoManual ?? (porPago > 0 ? String(porPago / 100) : '')}
              onChange={(e) => setPagoManual(e.target.value)}
              placeholder="0.00"
              className="cifras"
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tasa anual" ayuda="Opcional, en %" htmlFor="tasa">
            <Entrada
              id="tasa"
              value={tasaInteres}
              onChange={(e) => {
                setTasaInteres(e.target.value)
                setPagoManual(null)
              }}
              inputMode="decimal"
              placeholder="36"
              className="cifras"
            />
          </Campo>
          <Campo etiqueta="Próximo pago" htmlFor="vence">
            <CampoFecha id="vence" valor={fechaLimite} onCambio={setFechaLimite} locale={ajustes.locale} />
          </Campo>
        </div>

        {/* El resumen responde "¿de cuánto me sale?" antes de guardar nada. */}
        {monto > 0 && porPago > 0 && (
          <div className="animar-entrada rounded-tarjeta bg-elevada p-4">
            <p className="text-[15px] leading-relaxed text-tinta">
              Pagas <span className="cifras font-semibold">{dinero(porPago)}</span>{' '}
              {periodicidad === 'unico'
                ? 'una sola vez'
                : `cada ${PERIODICIDAD[periodicidad].toLowerCase()}`}
              {periodicidad !== 'unico' && (
                <>
                  , <span className="cifras font-semibold">{pagosReales}</span> {unidad}
                </>
              )}
              .
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[12px] text-tenue">Compromiso al mes</dt>
                <dd className="cifras text-[17px] font-semibold text-tinta">{dinero(mensual)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-tenue">Terminas en</dt>
                <dd className="text-[17px] font-semibold text-tinta capitalize">
                  {periodicidad === 'unico'
                    ? formatearFecha(fechaLimite, ajustes.locale)
                    : nombrePeriodo(
                        sumarMeses(
                          periodoDe(fechaLimite),
                          Math.max(0, Math.ceil(pagosReales / porMes) - 1),
                        ),
                      )}
                </dd>
              </div>
              {tasa !== null && tasa > 0 && (
                <div>
                  <dt className="text-[12px] text-tenue">Pagarás en total</dt>
                  <dd className="cifras text-[17px] font-semibold text-tinta">
                    {dinero(porPago * pagosReales)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <Boton type="submit" ancho disabled={!valido}>
          {editando ? 'Guardar cambios' : 'Registrar deuda'}
        </Boton>
      </form>
    </Modal>
  )
}

function FormularioPago({ deuda, onCerrar }: { deuda: Deuda; onCerrar: () => void }) {
  const { ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const [monto, setMonto] = useState(
    deuda.pagoMinimo > 0 ? String(Math.min(deuda.pagoMinimo, deuda.saldoActual) / 100) : '',
  )
  const [fecha, setFecha] = useState(hoyISO)
  const [nota, setNota] = useState('')
  const [avanzar, setAvanzar] = useState(deuda.periodicidad !== 'unico')

  const centavos = aCentavos(monto)

  async function guardar() {
    if (centavos <= 0) return
    await registrarPago(deuda.id, centavos, fecha, nota.trim())
    await refrescar()
    const restante = Math.max(0, deuda.saldoActual - centavos)
    mostrar(
      restante === 0
        ? `¡Liquidaste ${deuda.acreedor}!`
        : `Abono registrado. Quedan ${formatearMoneda(restante, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })}`,
    )
    onCerrar()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Registrar abono" descripcion={deuda.acreedor} ancho="sm:max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="abono" className="mb-1.5 block text-[13px] font-medium text-suave">
            Monto
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <EntradaMoneda
              id="abono"
              base={false}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-[13px] text-tenue">
            Saldo actual: {formatearMoneda(deuda.saldoActual, ajustes.moneda, ajustes.locale)}
          </p>
        </div>

        <Campo etiqueta="Fecha" htmlFor="fechaAbono">
          <CampoFecha id="fechaAbono" valor={fecha} onCambio={setFecha} locale={ajustes.locale} />
        </Campo>

        <Campo etiqueta="Nota" ayuda="Opcional" htmlFor="notaAbono">
          <Entrada id="notaAbono" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} />
        </Campo>

        {deuda.periodicidad !== 'unico' && (
          <label className="flex items-center gap-2.5 text-[15px] text-suave">
            <input
              type="checkbox"
              checked={avanzar}
              onChange={(e) => setAvanzar(e.target.checked)}
              className="size-4 accent-acento"
            />
            Mover la fecha de pago al siguiente periodo
          </label>
        )}

        <Boton type="submit" ancho disabled={centavos <= 0}>
          Registrar abono
        </Boton>
      </form>
    </Modal>
  )
}

function HistorialPagos({ deuda, onCerrar }: { deuda: Deuda; onCerrar: () => void }) {
  const { pagos, ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const mios = [...pagosDeDeuda(pagos, deuda.id)].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Historial de abonos" descripcion={deuda.acreedor} ancho="sm:max-w-md">
      {mios.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-tenue">Todavía no registras abonos a esta deuda.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {mios.map((pago) => (
            <li key={pago.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-tinta">{formatearFecha(pago.fecha, ajustes.locale)}</p>
                {pago.nota && <p className="truncate text-[13px] text-tenue">{pago.nota}</p>}
              </div>
              <span className="cifras text-[15px] font-medium text-tinta">
                {formatearMoneda(pago.monto, ajustes.moneda, ajustes.locale)}
              </span>
              <button
                type="button"
                onClick={() => {
                  void eliminarPago(pago.id)
                    .then(() => refrescar())
                    .then(() => mostrar('Abono eliminado y saldo recalculado', 'info'))
                }}
                aria-label="Eliminar abono"
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
