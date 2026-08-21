import type { Margen, Tope } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFechaCorta } from '@/dominio/fechas'
import { useFormato } from '@/estado/finanzas'
import { Modal } from './ui/Modal'
import { clases } from './ui/Basicos'

/**
 * De dónde sale la cifra grande del tablero, en dos cuentas separadas.
 *
 * La primera es de **flujo**: lo que el ciclo produce, contando el cobro que
 * todavía no cae. La segunda es de **caja**: lo que hay en el banco hoy, lo
 * que va a entrar y lo que ya tiene dueño. Son dos preguntas distintas y
 * antes iban revueltas en una sola columna de restas: por eso aparecían
 * renglones como "pero en tu cuenta hay −$5,146", que no describe ninguna
 * cuenta bancaria del mundo.
 *
 * Lo gastable es el más apretado de los tres topes, y el modal dice cuál
 * ganó. Una cifra sin origen no se cree ni se usa.
 */
export function DesgloseMargen({
  abierto,
  onCerrar,
  margen,
}: {
  abierto: boolean
  onCerrar: () => void
  margen: Margen
}) {
  const { moneda, locale } = useFormato()
  const dinero = (c: number) => formatearMoneda(c, moneda, locale, { conDecimales: 'auto' })
  const ventana = esteCiclo(margen.ciclo.tipo)
  const cobro = margen.ciclo.tipo === 'mensual' ? 'tu sueldo' : `tu ${margen.ciclo.nombre}`

  const flujo = [
    {
      etiqueta: margen.ingresosEstimados
        ? `Ingreso estimado ${delCiclo(margen.ciclo.tipo)}`
        : `Ingreso ${delCiclo(margen.ciclo.tipo)}`,
      valor: margen.ingresos,
      signo: '',
      nota: margen.ingresosEstimados
        ? margen.fechaProximoCobro
          ? `Cae el ${formatearFechaCorta(margen.fechaProximoCobro, locale)}. Todavía no está registrado.`
          : 'Sale de tu sueldo configurado. Todavía no registras el depósito.'
        : undefined,
    },
    { etiqueta: 'Gastos registrados', valor: -margen.egresos, signo: '−' },
    { etiqueta: 'Pagos de deuda por vencer', valor: -margen.compromisoDeuda, signo: '−' },
    { etiqueta: 'Gastos fijos que faltan', valor: -margen.compromisoRecurrente, signo: '−' },
    { etiqueta: `Aporte a metas ${ventana}`, valor: -margen.compromisoMeta, signo: '−' },
  ]

  const caja =
    margen.efectivoHoy === null
      ? []
      : [
          { etiqueta: 'Tienes ahora en la cuenta', valor: margen.efectivoHoy, signo: '' },
          { etiqueta: `Falta por entrar de ${cobro}`, valor: margen.porEntrar, signo: '+' },
          { etiqueta: 'Ya comprometido', valor: -margen.comprometido, signo: '−' },
        ]

  const PORQUE: Record<Tope, string> = {
    caja: 'Manda lo que hay en la cuenta: no se puede gastar un depósito que todavía no llega.',
    compromisos:
      'Manda lo comprometido: aun contando el cobro que falta, el ciclo no cierra con qué cubrirlo todo.',
    flujo:
      'Manda el flujo del ciclo: el ahorro de meses anteriores no se reparte entre los días que quedan.',
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="De dónde sale ese número"
      descripcion={`Cuentas ${delCiclo(margen.ciclo.tipo)}, del ${formatearFechaCorta(margen.ciclo.inicio, locale)} al ${formatearFechaCorta(margen.ciclo.fin, locale)}.`}
      ancho="sm:max-w-md"
    >
      <Encabezado>Lo que produce {ventana}</Encabezado>
      <Lista renglones={flujo} dinero={dinero} />
      <Total
        etiqueta={margen.margenLibre >= 0 ? 'Te queda libre' : 'Vas por encima'}
        valor={dinero(Math.abs(margen.margenLibre))}
        tono={margen.margenLibre >= 0 ? 'text-tinta' : 'text-rojo'}
      />

      {caja.length > 0 && (
        <>
          <Encabezado>Lo que hay en el banco</Encabezado>
          <Lista renglones={caja} dinero={dinero} />
          <Total
            etiqueta="Cerrarías el ciclo con"
            valor={dinero(margen.proyeccionCierre ?? 0)}
            tono={(margen.proyeccionCierre ?? 0) >= 0 ? 'text-tinta' : 'text-rojo'}
          />
        </>
      )}

      <div className="mt-4 rounded-campo bg-elevada px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium text-tinta">Con esto puedes contar</p>
          <span
            className={clases(
              'cifras cifra-lg shrink-0 font-semibold',
              margen.margenDisponible >= 0 ? 'text-verde' : 'text-rojo',
            )}
          >
            {dinero(margen.margenDisponible)}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-tenue">{PORQUE[margen.tope]}</p>
      </div>

      {margen.diasRestantes > 0 && margen.margenDisponible > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <p className="text-[15px] text-suave">
              Entre los {margen.diasRestantes} {margen.diasRestantes === 1 ? 'día' : 'días'} que
              faltan
            </p>
            <span className="cifras cifra-md shrink-0 font-medium text-suave">
              ÷ {margen.diasRestantes}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-campo bg-elevada px-3 py-3">
            <p className="text-[15px] font-medium text-tinta">Puedes gastar hoy</p>
            <span className="cifras cifra-lg shrink-0 font-semibold text-verde">
              {dinero(margen.gastoDiarioSugerido)}
            </span>
          </div>
        </>
      )}

      {margen.comprometidoDespues > 0 && (
        <p className="mt-4 text-[13px] leading-relaxed text-tenue">
          Justo después del cierre vencen{' '}
          <span className="cifras font-medium text-suave">{dinero(margen.comprometidoDespues)}</span>{' '}
          más. No entran en esta cuenta porque los cubre el cobro siguiente, pero ya tienen fecha.
        </p>
      )}
    </Modal>
  )
}

function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 mb-1 text-[11px] font-medium uppercase tracking-wide text-tenue first:mt-0">
      {children}
    </p>
  )
}

/**
 * Los renglones en cero se muestran igual, atenuados: ver los ceros enseña la
 * fórmula. Ocultarlos deja la resta incompleta y el resultado vuelve a ser
 * mágico.
 */
function Lista({
  renglones,
  dinero,
}: {
  renglones: Array<{ etiqueta: string; valor: number; signo: string; nota?: string }>
  dinero: (c: number) => string
}) {
  return (
    <ul className="divide-y divide-borde">
      {renglones.map((r) => (
        <li key={r.etiqueta} className="flex items-baseline justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className={clases('text-[15px]', r.valor === 0 ? 'text-tenue' : 'text-suave')}>
              {r.etiqueta}
            </p>
            {r.nota && <p className="mt-0.5 text-[13px] text-tenue">{r.nota}</p>}
          </div>
          <span
            className={clases(
              'cifras cifra-md shrink-0 font-medium',
              r.valor === 0 ? 'text-tenue' : 'text-tinta',
            )}
          >
            {r.signo}
            {dinero(Math.abs(r.valor))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Total({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t-2 border-borde-fuerte py-3">
      <p className="text-[15px] font-medium text-tinta">{etiqueta}</p>
      <span className={clases('cifras cifra-lg shrink-0 font-semibold', tono)}>{valor}</span>
    </div>
  )
}
