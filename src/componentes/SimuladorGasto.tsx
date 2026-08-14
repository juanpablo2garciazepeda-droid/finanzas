import { useMemo, useState } from 'react'
import type { MetodoPago } from '@/dominio/tipos'
import { calcularMargen, evaluarGasto } from '@/dominio/alertas'
import { ordenarPorUso } from '@/dominio/categorias'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { hoyISO, sumarDias } from '@/dominio/fechas'
import { crearTransaccion } from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { Boton, EntradaMoneda, clases } from './ui/Basicos'
import { Icono } from './ui/Icono'
import { Modal } from './ui/Modal'
import { MedidorMargen } from './MedidorMargen'

const CLAVE_METODO = 'finanzas.ultimoMetodo'

/**
 * "Quiero comprar esto, ¿puedo?".
 *
 * Es la misma evaluación que hace el formulario de gasto, pero sin obligar a
 * registrar nada: la pregunta se hace antes de pagar, y muchas veces la
 * respuesta es que no. Si la respuesta convence, se registra desde aquí sin
 * volver a teclear el monto.
 */
export function SimuladorGasto({ onCerrar }: { onCerrar: () => void }) {
  const { ctx, categoriasActivas, ajustes, refrescar } = useFinanzas()
  const { mostrar } = useAvisos()
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(monto)

  const opciones = useMemo(
    () =>
      ordenarPorUso(
        categoriasActivas.filter((c) => c.tipo === 'egreso'),
        ctx.transacciones,
        sumarDias(ctx.hoy, -90),
      ).slice(0, 8),
    [categoriasActivas, ctx.transacciones, ctx.hoy],
  )

  const veredicto = useMemo(
    () => evaluarGasto(centavos, categoriaId || null, ctx),
    [centavos, categoriaId, ctx],
  )
  const margen = useMemo(() => calcularMargen(ctx), [ctx])

  async function registrar() {
    if (centavos <= 0) return
    setGuardando(true)
    try {
      await crearTransaccion({
        tipo: 'egreso',
        monto: centavos,
        // Sin categoría elegida cae en la primera de gasto, que la persona
        // puede corregir después desde Movimientos.
        categoriaId: categoriaId || opciones[0]?.id || '',
        fecha: hoyISO(),
        metodoPago: (localStorage.getItem(CLAVE_METODO) as MetodoPago | null) ?? 'debito',
        nota: '',
      })
      await refrescar()
      mostrar(`Gasto de ${formatearMoneda(centavos, ajustes.moneda, ajustes.locale)} registrado`)
      onCerrar()
    } catch {
      mostrar('No se pudo registrar el gasto', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="¿Me lo puedo permitir?"
      descripcion="Escribe cuánto cuesta y te digo si cabe. No se registra nada hasta que tú digas."
      ancho="sm:max-w-lg"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="montoSimulado" className="mb-1.5 block text-[13px] font-medium text-suave">
            Cuánto cuesta
          </label>
          <div className="flex items-baseline gap-2 border-b border-borde pb-2 focus-within:border-acento">
            <span className="cifras text-2xl text-tenue">$</span>
            <EntradaMoneda
              id="montoSimulado"
              base={false}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              autoFocus
              className="cifras w-full bg-transparent text-4xl font-semibold text-tinta placeholder:text-tenue focus:outline-none"
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-suave">
            ¿De qué es? <span className="font-normal text-tenue">(opcional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {opciones.map((categoria) => {
              const activa = categoria.id === categoriaId
              return (
                <button
                  key={categoria.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setCategoriaId(activa ? '' : categoria.id)}
                  className={clases(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] transition-colors',
                    activa
                      ? 'bg-acento text-sobre-acento'
                      : 'bg-elevada text-tinta hover:bg-hundida',
                  )}
                >
                  <Icono
                    nombre={categoria.icono}
                    className="size-4"
                    style={{ color: activa ? undefined : categoria.color }}
                    strokeWidth={1.75}
                  />
                  {categoria.nombre}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[13px] text-tenue">
            Elegir categoría permite medirlo también contra su presupuesto.
          </p>
        </div>

        {centavos > 0 ? (
          <div className="animar-entrada rounded-tarjeta bg-elevada p-4">
            <MedidorMargen veredicto={veredicto} margen={margen} monto={centavos} compacto />
          </div>
        ) : (
          <p className="rounded-tarjeta bg-elevada p-4 text-center text-[15px] text-suave">
            Escribe un monto y te respondo con lo que te queda de{' '}
            {margen.ciclo.tipo === 'mensual' ? 'mes' : margen.ciclo.nombre}, tus deudas y tus metas.
          </p>
        )}

        <div className="flex gap-2">
          <Boton variante="secundario" onClick={onCerrar} className="flex-1">
            {veredicto.nivel === 'rojo' && centavos > 0 ? 'Mejor no' : 'Cerrar'}
          </Boton>
          <Boton
            variante={veredicto.nivel === 'rojo' ? 'secundario' : 'primario'}
            onClick={() => void registrar()}
            disabled={centavos <= 0 || guardando}
            className="flex-1"
          >
            {guardando
              ? 'Guardando…'
              : veredicto.nivel === 'rojo'
                ? 'Registrarlo igual'
                : 'Sí, registrarlo'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
