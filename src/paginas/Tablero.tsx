import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, CircleQuestionMark as HelpCircle, Plus } from 'lucide-react'
import { calcularMargen, evaluarGasto } from '@/dominio/alertas'
import { delCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { fechaRelativa, formatearFechaCorta, nombrePeriodo } from '@/dominio/fechas'
import { deudaTotal, proximosVencimientos } from '@/dominio/deudas'
import { ahorroTotal } from '@/dominio/metas'
import { gastoPorCategoria, transaccionesDelPeriodo } from '@/dominio/presupuestos'
import { generarRecomendaciones } from '@/dominio/recomendaciones'
import { calcularSalud, serieDeudaYAhorro, serieHistorica } from '@/dominio/salud'
import { useFinanzas } from '@/estado/finanzas'
import { useT } from '@/estado/i18n'
import { MedidorMargen } from '@/componentes/MedidorMargen'
import { SimuladorGasto } from '@/componentes/SimuladorGasto'
import { ConfirmarCobro } from '@/componentes/ConfirmarCobro'
import { PanelDinero } from '@/componentes/PanelDinero'
import { MedidorSalud } from '@/componentes/MedidorSalud'
import { FormularioMovimiento } from '@/componentes/FormularioMovimiento'
import { Boton, Cifra, Insignia, Tarjeta, TituloSeccion, clases } from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
/**
 * Las gráficas cargan aparte: Recharts es la mitad del peso del arranque y
 * ninguna de las tres se ve sin desplazarse. Lo primero que se mira —cuánto
 * puedo gastar hoy— no tiene por qué esperar a que baje una librería de dibujo.
 */
const GraficaFlujo = lazy(() =>
  import('@/graficas/Graficas').then((m) => ({ default: m.GraficaFlujo })),
)
const GraficaCategorias = lazy(() =>
  import('@/graficas/Graficas').then((m) => ({ default: m.GraficaCategorias })),
)
const GraficaEvolucion = lazy(() =>
  import('@/graficas/Graficas').then((m) => ({ default: m.GraficaEvolucion })),
)

/** Hueco de la altura de la gráfica, para que el resto no brinque al llegar. */
function EsperaGrafica({ alto = 200 }: { alto?: number }) {
  return <div className="animate-pulse rounded-campo bg-elevada" style={{ height: alto }} />
}

export function Tablero() {
  const t = useT()
  const { ctx, categorias, deudas, metas, pagos, ajustes, hayMovimientos, hayDatos, periodo, cargando } =
    useFinanzas()
  const { moneda, locale } = ajustes
  const [simulando, setSimulando] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  const margen = useMemo(() => calcularMargen(ctx), [ctx])
  const veredicto = useMemo(() => evaluarGasto(0, null, ctx), [ctx])
  const salud = useMemo(() => calcularSalud(ctx), [ctx])
  const recomendaciones = useMemo(() => generarRecomendaciones(ctx, pagos), [ctx, pagos])
  const vencimientos = useMemo(
    () => proximosVencimientos(deudas, ctx.hoy, 15).slice(0, 4),
    [deudas, ctx.hoy],
  )
  const flujo = useMemo(() => serieHistorica(ctx, 6), [ctx])
  const evolucion = useMemo(() => serieDeudaYAhorro(ctx, pagos, 6), [ctx, pagos])

  const rebanadas = useMemo(() => {
    const gastos = gastoPorCategoria(transaccionesDelPeriodo(ctx.transacciones, periodo))
    return [...gastos.entries()].map(([id, valor]) => {
      const categoria = categorias.find((c) => c.id === id)
      return { nombre: categoria?.nombre ?? 'Sin categoría', valor, color: categoria?.color ?? '#86868B' }
    })
  }, [ctx.transacciones, periodo, categorias])

  if (cargando) return <Esqueleto />
  if (!hayDatos) return <Bienvenida />

  const dinero = (c: number) => formatearMoneda(c, moneda, locale, { conDecimales: 'auto' })

  return (
    <div className="space-y-6">
      {/* La tesis de la app: cuánto puedes gastar hoy sin romper nada. */}
      <Tarjeta className="pt-6">
        <MedidorMargen veredicto={veredicto} margen={margen} monto={0} />
        <Boton ancho className="mt-5" onClick={() => setSimulando(true)}>
          <HelpCircle className="size-[18px]" aria-hidden />
          {t('tablero.permitir')}
        </Boton>
      </Tarjeta>

      <ConfirmarCobro margen={margen} />

      <PanelDinero margen={margen} />

      {/* Con deudas y sueldo cargados pero sin un solo gasto, el tablero no
          tiene con qué medir: hay que decirlo en vez de mostrar ceros. */}
      {!hayMovimientos && (
        <Tarjeta className="flex flex-col items-start gap-3">
          <div>
            <p className="font-display text-[17px] font-semibold text-tinta">
              {t('tablero.falta_gastos')}
            </p>
            <p className="mt-1 text-[15px] text-suave">
              {t('tablero.falta_detalle')}
            </p>
          </div>
          <Boton variante="secundario" onClick={() => setRegistrando(true)}>
            <Plus className="size-4" aria-hidden />
            {t('tablero.primer_gasto')}
          </Boton>
        </Tarjeta>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta>
          {/* Este número es del ciclo, no del mes: la etiqueta tiene que decirlo
              o se lee como si fuera el balance mensual. */}
          {/* Con saldo declarado, "cuánto tienes" ya lo dice el panel de arriba;
              aquí va lo que no está en ningún otro sitio: cuánto se ha ido. */}
          {margen.saldo.declarado ? (
            <Cifra
              etiqueta={t('tablero.gastado_ciclo', { ciclo: delCiclo(margen.ciclo.tipo) })}
              valor={dinero(margen.egresos)}
              detalle={
                margen.ingresosReales > 0
                  ? t('tablero.entraron', { monto: dinero(margen.ingresosReales) })
                  : t('tablero.sin_ingresos')
              }
            />
          ) : (
            <Cifra
              etiqueta={t('tablero.balance_ciclo', { ciclo: delCiclo(margen.ciclo.tipo) })}
              valor={dinero(margen.flujoDelCiclo)}
              tono={margen.flujoDelCiclo >= 0 ? 'text-tinta' : 'text-rojo'}
              detalle={
                margen.ingresosEstimados
                  ? t('tablero.estimados', { monto: dinero(margen.ingresos) })
                  : t('tablero.entraron', { monto: dinero(margen.ingresosReales) })
              }
            />
          )}
        </Tarjeta>
        <Tarjeta>
          <Cifra
            etiqueta={t('tablero.deuda_total')}
            valor={dinero(deudaTotal(deudas))}
            detalle={t('tablero.activas', { n: deudas.filter((d) => !d.liquidada).length })}
          />
        </Tarjeta>
        <Tarjeta>
          <Cifra
            etiqueta={t('tablero.ahorro_total')}
            valor={dinero(ahorroTotal(metas))}
            detalle={t('tablero.metas_en_curso', { n: metas.filter((m) => !m.completada).length })}
          />
        </Tarjeta>
        <Tarjeta>
          <Cifra
            etiqueta={t('tablero.salud')}
            valor={salud.suficiente ? String(salud.puntaje) : '—'}
            detalle={salud.etiqueta}
            tono={
              !salud.suficiente
                ? 'text-tenue'
                : salud.puntaje >= 70
                  ? 'text-verde'
                  : salud.puntaje >= 45
                    ? 'text-ambar'
                    : 'text-rojo'
            }
          />
        </Tarjeta>
      </div>

      {vencimientos.length > 0 && (
        <section>
          <TituloSeccion
            accion={
              <Link to="/deudas" className="inline-flex items-center gap-1 text-xs text-acento hover:underline">
                {t('tablero.ver_deudas')} <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            {t('tablero.proximos_pagos')}
          </TituloSeccion>
          <Tarjeta className="divide-y divide-borde p-0">
            {vencimientos.map((v) => (
              <div key={v.deuda.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarClock
                  className={clases('size-4 shrink-0', v.vencido ? 'text-rojo' : v.dias <= 3 ? 'text-ambar' : 'text-tenue')}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-tinta">{v.deuda.acreedor}</p>
                  <p className="text-xs text-tenue">
                    {formatearFechaCorta(v.fecha, locale)} · {fechaRelativa(ctx.hoy, v.fecha)}
                  </p>
                </div>
                <span className="cifras text-sm font-medium text-tinta">{dinero(v.monto)}</span>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}

      {recomendaciones.length > 0 && (
        <section>
          <TituloSeccion>{t('tablero.recomendaciones')}</TituloSeccion>
          <div className="grid gap-3 sm:grid-cols-2">
            {recomendaciones.slice(0, 4).map((r) => (
              <Tarjeta key={r.id} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-acento-suave">
                  <Icono nombre={r.icono} className="size-4 text-acento" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-tinta">{r.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-suave">{r.detalle}</p>
                </div>
              </Tarjeta>
            ))}
          </div>
        </section>
      )}

      <section>
        <TituloSeccion>{t('tablero.flujo')}</TituloSeccion>
        <Tarjeta>
          <Suspense fallback={<EsperaGrafica />}>
            <GraficaFlujo datos={flujo} />
          </Suspense>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>{t('tablero.categorias', { periodo: nombrePeriodo(periodo) })}</TituloSeccion>
        <Tarjeta>
          <Suspense fallback={<EsperaGrafica alto={180} />}>
            <GraficaCategorias datos={rebanadas} />
          </Suspense>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>{t('tablero.evolucion')}</TituloSeccion>
        <Tarjeta>
          <Suspense fallback={<EsperaGrafica />}>
            <GraficaEvolucion datos={evolucion} />
          </Suspense>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion
          accion={
            <Insignia
              neutra={!salud.suficiente}
              nivel={salud.puntaje >= 70 ? 'verde' : salud.puntaje >= 45 ? 'ambar' : 'rojo'}
            >
              {salud.etiqueta}
            </Insignia>
          }
        >
          {salud.suficiente
            ? t('tablero.salud_puntos', { puntos: salud.puntaje })
            : t('tablero.salud')}
        </TituloSeccion>
        <Tarjeta className="space-y-4">
          <MedidorSalud salud={salud} />
          {salud.componentes.map((componente) => (
            <div key={componente.clave}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className={clases('text-sm', componente.aplicable ? 'text-tinta' : 'text-tenue')}>
                  {componente.nombre}
                </span>
                {/* Puntos sobre el peso, no un porcentaje: "0%" junto a "se
                    llevan el 55% de tu ingreso" se lee como la métrica. */}
                <span className="cifras text-xs text-suave">
                  {componente.aplicable
                    ? `${Math.round(componente.calificacion * componente.peso)} / ${componente.peso} pts`
                    : 'sin datos'}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-fondo">
                <div
                  className={clases(
                    'h-full rounded-full transition-all duration-500',
                    componente.aplicable ? 'bg-acento' : 'bg-borde',
                  )}
                  style={{ width: `${componente.aplicable ? componente.calificacion * 100 : 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-tenue">{componente.detalle}</p>
            </div>
          ))}
        </Tarjeta>
      </section>

      {simulando && <SimuladorGasto onCerrar={() => setSimulando(false)} />}

      <FormularioMovimiento abierto={registrando} onCerrar={() => setRegistrando(false)} />
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-4">
      <div className="h-64 animate-pulse rounded-tarjeta bg-superficie" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-tarjeta bg-superficie" />
        ))}
      </div>
    </div>
  )
}

function Bienvenida() {
  const t = useT()
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-tinta">
        {t('tablero.bienvenida_titulo')}
      </h1>
      <p className="mt-3 text-suave">
        {t('tablero.bienvenida_detalle')}
      </p>

      <div className="mt-8 space-y-3 text-left">
        {[
          [t('tablero.bienvenida_p1_titulo'), t('tablero.bienvenida_p1_detalle')],
          [t('tablero.bienvenida_p2_titulo'), t('tablero.bienvenida_p2_detalle')],
          [t('tablero.bienvenida_p3_titulo'), t('tablero.bienvenida_p3_detalle')],
        ].map(([titulo, detalle], i) => (
          <div key={titulo} className="flex gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
            <span className="cifras flex size-7 shrink-0 items-center justify-center rounded-full bg-acento-suave text-sm font-semibold text-acento">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-tinta">{titulo}</p>
              <p className="mt-0.5 text-xs text-suave">{detalle}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-tenue">
        {t('tablero.bienvenida_empezar', { simbolo: '+' }).split('+').map((parte, i, arr) => (
          <span key={i}>
            {parte}
            {i < arr.length - 1 && <span className="cifras font-semibold">+</span>}
          </span>
        ))}
      </p>
    </div>
  )
}
