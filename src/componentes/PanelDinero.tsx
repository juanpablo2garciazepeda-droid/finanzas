import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, CreditCard, Repeat, Target, Wallet } from 'lucide-react'
import type { Margen } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFecha, formatearFechaCorta } from '@/dominio/fechas'
import { useFinanzas } from '@/estado/finanzas'
import { Boton, Tarjeta, TituloSeccion, clases } from './ui/Basicos'

/**
 * El estado de cuenta del ciclo, en el orden en que un contador lo leería:
 *
 *   Tienes ahora          (caja)
 * + Por entrar            (el cobro que falta, con su fecha si se sabe)
 * − Comprometido          (deuda + gastos fijos + metas, desglosado)
 * ─────────────────────
 * = Te queda para gastar  (lo más apretado de los tres topes)
 *
 * Cada renglón es una magnitud distinta y la app las nombra por separado. La
 * versión anterior restaba los compromisos de la caja y llamaba al resultado
 * "te queda de respaldo": con $27 en el banco y $5,173 por pagar, ese renglón
 * decía −$5,146, que no es un saldo de nada. El pago se iba a cubrir con la
 * quincena que faltaba, y esa quincena no aparecía por ningún lado.
 */
export function PanelDinero({ margen }: { margen: Margen }) {
  const { ajustes } = useFinanzas()
  const { saldo } = margen
  const dinero = (c: number) =>
    formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: 'auto' })
  const cobro = margen.ciclo.tipo === 'mensual' ? 'tu sueldo' : `tu ${margen.ciclo.nombre}`

  if (!saldo.declarado) {
    return (
      <section>
        <TituloSeccion>Tu dinero</TituloSeccion>
        <Tarjeta className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento-suave">
            <Wallet className="size-5 text-acento" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-semibold text-tinta">
              No sé cuánto tienes en el banco
            </p>
            <p className="mt-0.5 text-[15px] text-suave">
              Ahorita calculo tu margen con lo que entra y sale. Si me dices cuánto tienes hoy en la
              cuenta, puedo decirte el dinero real y no una estimación.
            </p>
          </div>
          <Boton variante="secundario" className="shrink-0">
            <Link to="/ajustes">Poner mi saldo</Link>
          </Boton>
        </Tarjeta>
      </section>
    )
  }

  const compromisos = [
    {
      icono: CreditCard,
      etiqueta: 'Pagos de deuda por vencer',
      valor: margen.compromisoDeuda,
    },
    {
      icono: Repeat,
      etiqueta: 'Gastos fijos que faltan',
      valor: margen.compromisoRecurrente,
    },
    {
      icono: Target,
      etiqueta: `Aporte a metas ${esteCiclo(margen.ciclo.tipo)}`,
      valor: margen.compromisoMeta,
    },
  ].filter((c) => c.valor > 0)

  // Por qué la cifra de abajo es la que es. Los tres topes producen tres
  // explicaciones distintas y dar la equivocada es peor que no dar ninguna.
  const porQue =
    margen.tope === 'caja'
      ? margen.porEntrar > 0
        ? `Es lo que hay en la cuenta hoy. ${cobro[0].toUpperCase()}${cobro.slice(1)} todavía no cae.`
        : 'Es lo que hay en la cuenta hoy.'
      : margen.tope === 'compromisos'
        ? `Aun contando lo que falta por entrar, no alcanza para todo lo comprometido ${esteCiclo(margen.ciclo.tipo)}.`
        : `Sale de lo que entra ${esteCiclo(margen.ciclo.tipo)}, no de tu ahorro: eso se queda donde está.`

  return (
    <section>
      <TituloSeccion
        accion={
          <Link to="/ajustes" className="inline-flex items-center gap-1 text-[13px] text-acento hover:underline">
            Ajustar saldo <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        Tu dinero
      </TituloSeccion>

      <Tarjeta className="divide-y divide-borde p-0">
        <Renglon
          etiqueta="Tienes ahora"
          detalle={`En la cuenta, desde tu saldo del ${formatearFecha(saldo.desde, ajustes.locale)}`}
          valor={dinero(saldo.actual)}
          tono={saldo.actual >= 0 ? 'text-tinta' : 'text-rojo'}
        />

        {margen.porEntrar > 0 && (
          <Renglon
            etiqueta="Por entrar"
            detalle={
              margen.fechaProximoCobro
                ? `${cobro[0].toUpperCase()}${cobro.slice(1)}, el ${formatearFechaCorta(margen.fechaProximoCobro, ajustes.locale)}`
                : `${cobro[0].toUpperCase()}${cobro.slice(1)}, estimada. Créala como ingreso recurrente para saber el día exacto.`
            }
            valor={`+ ${dinero(margen.porEntrar)}`}
            tono="text-suave"
          />
        )}

        <div className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[15px] text-suave">Comprometido</p>
            <span className="cifras shrink-0 text-[19px] font-semibold text-suave">
              {margen.comprometido > 0 ? '− ' : ''}
              {dinero(margen.comprometido)}
            </span>
          </div>
          {compromisos.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {compromisos.map(({ icono: Icono, etiqueta, valor }) => (
                <li key={etiqueta} className="flex items-center gap-2 text-[13px] text-tenue">
                  <Icono className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
                  <span className="cifras shrink-0">{dinero(valor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-[13px] text-tenue">
              Nada por vencer antes de que cierre {esteCiclo(margen.ciclo.tipo).replace('esta ', 'la ')}.
            </p>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-4 bg-elevada px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-tinta">Te queda para gastar</p>
            <p className="mt-0.5 text-[13px] text-tenue">{porQue}</p>
          </div>
          <span
            className={clases(
              'cifras shrink-0 text-[26px] font-semibold',
              margen.margenDisponible > 0 ? 'text-verde' : 'text-rojo',
            )}
          >
            {dinero(margen.margenDisponible)}
          </span>
        </div>
      </Tarjeta>

      {/* Lo que vence después del cierre no se resta de este ciclo, pero
          tampoco se calla: es el compromiso que ya tiene fecha y al que le
          toca el cobro siguiente. */}
      {margen.comprometidoDespues > 0 && (
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[13px] leading-relaxed text-tenue">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Además hay <span className="cifras font-medium text-suave">{dinero(margen.comprometidoDespues)}</span>{' '}
            en pagos justo después del cierre. No se descuentan de aquí porque los cubre{' '}
            {cobro} siguiente, pero conviene no gastárselo antes.
          </span>
        </p>
      )}

      {/* El desglose explica de dónde sale el "tienes ahora", que es justo lo
          que se pierde cuando un número aparece sin origen. */}
      <p className="mt-2 px-1 text-[13px] leading-relaxed text-tenue">
        {dinero(saldo.inicial)} que declaraste
        {saldo.ingresos > 0 && ` + ${dinero(saldo.ingresos)} que entraron`}
        {saldo.egresos > 0 && ` − ${dinero(saldo.egresos)} de gastos`}
        {saldo.pagosDeuda > 0 && ` − ${dinero(saldo.pagosDeuda)} de abonos a deudas`}
        {saldo.aportesMeta > 0 && ` − ${dinero(saldo.aportesMeta)} apartados a metas`}.
        {margen.margenLibre !== margen.margenDisponible && (
          <>
            {' '}
            {margen.margenLibre >= 0
              ? `Al cerrar ${delCiclo(margen.ciclo.tipo)} la cuenta habrá generado ${dinero(margen.margenLibre)}.`
              : `Ojo: ${esteCiclo(margen.ciclo.tipo)} vas ${dinero(-margen.margenLibre)} por encima de lo que entró.`}
          </>
        )}
      </p>
    </section>
  )
}

function Renglon({
  etiqueta,
  detalle,
  valor,
  tono,
}: {
  etiqueta: string
  detalle: string
  valor: string
  tono: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] text-suave">{etiqueta}</p>
        <p className="mt-0.5 text-[13px] text-tenue">{detalle}</p>
      </div>
      <span className={clases('cifras shrink-0 text-[19px] font-semibold', tono)}>{valor}</span>
    </div>
  )
}
