import { useEffect, useMemo, useState } from 'react'
import type { MetodoPago, TipoMovimiento, Transaccion } from '@/dominio/tipos'
import { evaluarGasto, calcularMargen } from '@/dominio/alertas'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { hoyISO, periodoDe, sumarDias } from '@/dominio/fechas'
import { ordenarPorUso } from '@/dominio/categorias'
import { crearTransaccion, actualizarTransaccion } from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { Boton, Campo, Entrada, Selector, clases } from './ui/Basicos'
import { CampoFecha } from './ui/CampoFecha'
import { Icono } from './ui/Icono'
import { Modal } from './ui/Modal'
import { MedidorMargen } from './MedidorMargen'

export const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: 'Débito' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'credito', etiqueta: 'Crédito' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'otro', etiqueta: 'Otro' },
]

const CLAVE_METODO = 'finanzas.ultimoMetodo'

export function FormularioMovimiento({
  abierto,
  onCerrar,
  editando,
  tipoInicial = 'egreso',
}: {
  abierto: boolean
  onCerrar: () => void
  editando?: Transaccion
  tipoInicial?: TipoMovimiento
}) {
  const { ctx, categoriasActivas, ajustes } = useFinanzas()
  const { mostrar } = useAvisos()

  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial)
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [fecha, setFecha] = useState(hoyISO)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('debito')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    if (editando) {
      setTipo(editando.tipo)
      setMonto(String(editando.monto / 100))
      setCategoriaId(editando.categoriaId)
      setFecha(editando.fecha)
      setMetodoPago(editando.metodoPago)
      setNota(editando.nota)
      return
    }
    setTipo(tipoInicial)
    setMonto('')
    setCategoriaId('')
    setFecha(hoyISO())
    setNota('')
    setMetodoPago((localStorage.getItem(CLAVE_METODO) as MetodoPago | null) ?? 'debito')
  }, [abierto, editando, tipoInicial])

  // Lo más usado en los últimos tres meses va primero: registrar un gasto
  // debería ser dos toques, no una búsqueda visual.
  const opciones = useMemo(
    () =>
      ordenarPorUso(
        categoriasActivas.filter((c) => c.tipo === tipo),
        ctx.transacciones,
        sumarDias(ctx.hoy, -90),
      ),
    [categoriasActivas, tipo, ctx.transacciones, ctx.hoy],
  )

  const centavos = aCentavos(monto)

  // El semáforo evalúa contra el mes del movimiento y sin contar la propia
  // transacción cuando se está editando: si no, se compararía consigo misma.
  const contextoEvaluacion = useMemo(
    () => ({
      ...ctx,
      periodo: periodoDe(fecha),
      transacciones: editando ? ctx.transacciones.filter((t) => t.id !== editando.id) : ctx.transacciones,
    }),
    [ctx, fecha, editando],
  )

  const veredicto = useMemo(
    () => evaluarGasto(centavos, categoriaId || null, contextoEvaluacion),
    [centavos, categoriaId, contextoEvaluacion],
  )
  const margen = useMemo(() => calcularMargen(contextoEvaluacion), [contextoEvaluacion])

  const puedeGuardar = centavos > 0 && categoriaId !== '' && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const datos = { tipo, monto: centavos, categoriaId, fecha, metodoPago, nota: nota.trim() }
      if (editando) {
        await actualizarTransaccion(editando.id, datos)
        mostrar('Movimiento actualizado')
      } else {
        await crearTransaccion(datos)
        localStorage.setItem(CLAVE_METODO, metodoPago)
        const texto = formatearMoneda(centavos, ajustes.moneda, ajustes.locale)
        mostrar(tipo === 'egreso' ? `Gasto de ${texto} registrado` : `Ingreso de ${texto} registrado`)
      }
      onCerrar()
    } catch {
      mostrar('No se pudo guardar el movimiento', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? 'Editar movimiento' : tipo === 'egreso' ? 'Nuevo gasto' : 'Nuevo ingreso'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-2 gap-1 rounded-full bg-elevada p-1">
          {(['egreso', 'ingreso'] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setTipo(valor)
                setCategoriaId('')
              }}
              className={clases(
                'rounded-full py-2 text-[15px] font-medium transition-colors',
                tipo === valor ? 'bg-superficie text-tinta shadow-sm' : 'text-suave hover:text-tinta',
              )}
            >
              {valor === 'egreso' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="monto" className="mb-1.5 block text-[13px] font-medium text-suave">
            Monto
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <input
              id="monto"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">Categoría</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {opciones.map((categoria) => {
              const activa = categoria.id === categoriaId
              return (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => setCategoriaId(categoria.id)}
                  aria-pressed={activa}
                  className={clases(
                    'flex flex-col items-center gap-1.5 rounded-campo border px-1 py-2.5 transition-all',
                    activa
                      ? 'border-acento bg-acento-suave'
                      : 'border-transparent bg-elevada hover:border-borde',
                  )}
                >
                  <Icono
                    nombre={categoria.icono}
                    className="size-5"
                    style={{ color: activa ? categoria.color : undefined }}
                    strokeWidth={1.75}
                  />
                  <span className="w-full truncate text-center text-[11px] leading-tight text-suave">
                    {categoria.nombre}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha" htmlFor="fecha">
            <CampoFecha id="fecha" valor={fecha} onCambio={setFecha} locale={ajustes.locale} />
          </Campo>
          <Campo etiqueta="Método" htmlFor="metodo">
            <Selector
              id="metodo"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            >
              {METODOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>

        <Campo etiqueta="Nota" ayuda="Opcional" htmlFor="nota">
          <Entrada
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Comida con el equipo"
            maxLength={120}
          />
        </Campo>

        {tipo === 'egreso' && centavos > 0 && (
          <div className="animar-entrada rounded-tarjeta bg-elevada p-4">
            <MedidorMargen veredicto={veredicto} margen={margen} monto={centavos} compacto />
          </div>
        )}

        <Boton type="submit" ancho disabled={!puedeGuardar}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar'}
        </Boton>
      </form>
    </Modal>
  )
}
