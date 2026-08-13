import { Link } from 'react-router-dom'
import { ArrowRight, Wallet } from 'lucide-react'
import type { Margen } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFecha } from '@/dominio/fechas'
import { useFinanzas } from '@/estado/finanzas'
import { Boton, Tarjeta, TituloSeccion, clases } from './ui/Basicos'

/**
 * "Tienes tanto, está comprometido tanto, te queda tanto".
 *
 * El resto del tablero razona sobre flujos del ciclo; esto responde a la
 * pregunta más simple y más frecuente, que es cuánto dinero hay. Solo aparece
 * completo cuando la persona declaró su saldo: inventar un "tienes" a partir de
 * movimientos incompletos sería peor que no mostrarlo.
 */
export function PanelDinero({ margen }: { margen: Margen }) {
  const { ajustes } = useFinanzas()
  const { saldo } = margen
  const dinero = (c: number) => formatearMoneda(c, ajustes.moneda, ajustes.locale, { conDecimales: false })

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

  const comprometido = margen.compromisoDeuda + margen.compromisoMeta
  // El respaldo es stock: el dinero que hay menos lo ya comprometido. No es lo
  // mismo que el margen del ciclo, y mezclarlos era el bug que invitaba a
  // repartir los ahorros entre los días que quedan de la quincena.
  const respaldo = margen.colchonTotal ?? 0

  const filas = [
    {
      etiqueta: 'Tienes ahora',
      valor: saldo.actual,
      detalle: `Desde tu saldo del ${formatearFecha(saldo.desde, ajustes.locale)}`,
      tono: saldo.actual >= 0 ? 'text-tinta' : 'text-rojo',
    },
    {
      etiqueta: 'Comprometido',
      valor: -comprometido,
      detalle: `Deudas por vencer y tu aporte ${delCiclo(margen.ciclo.tipo)}`,
      tono: 'text-suave',
    },
    {
      etiqueta: 'Te queda de respaldo',
      valor: respaldo,
      detalle:
        margen.margenLibre >= 0
          ? `Aparte, ${esteCiclo(margen.ciclo.tipo)} te sobran ${dinero(margen.margenLibre)} de lo que entró`
          : `Ojo: ${esteCiclo(margen.ciclo.tipo)} vas ${dinero(-margen.margenLibre)} por encima y sale de aquí`,
      tono: respaldo > 0 ? 'text-verde' : 'text-rojo',
      destacada: true,
    },
  ]

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
        {filas.map((fila) => (
          <div
            key={fila.etiqueta}
            className={clases(
              'flex items-baseline justify-between gap-4 px-4 py-3.5',
              fila.destacada && 'bg-elevada',
            )}
          >
            <div className="min-w-0">
              <p
                className={clases(
                  'text-[15px]',
                  fila.destacada ? 'font-medium text-tinta' : 'text-suave',
                )}
              >
                {fila.etiqueta}
              </p>
              <p className="mt-0.5 text-[13px] text-tenue">{fila.detalle}</p>
            </div>
            <span
              className={clases(
                'cifras shrink-0 font-semibold',
                fila.destacada ? 'text-[26px]' : 'text-[19px]',
                fila.tono,
              )}
            >
              {fila.valor < 0 && fila.etiqueta === 'Comprometido' ? '−' : ''}
              {dinero(Math.abs(fila.valor))}
            </span>
          </div>
        ))}
      </Tarjeta>

      {/* El desglose explica de dónde sale el "tienes ahora", que es justo lo
          que se pierde cuando un número aparece sin origen. */}
      <p className="mt-2 px-1 text-[13px] leading-relaxed text-tenue">
        {dinero(saldo.inicial)} que declaraste
        {saldo.ingresos > 0 && ` + ${dinero(saldo.ingresos)} que entraron`}
        {saldo.egresos > 0 && ` − ${dinero(saldo.egresos)} de gastos`}
        {saldo.pagosDeuda > 0 && ` − ${dinero(saldo.pagosDeuda)} de abonos a deudas`}
        {saldo.aportesMeta > 0 && ` − ${dinero(saldo.aportesMeta)} apartados a metas`}.
      </p>
    </section>
  )
}
