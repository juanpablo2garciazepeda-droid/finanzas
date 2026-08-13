import type { Margen } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFechaCorta } from '@/dominio/fechas'
import { useFormato } from '@/estado/finanzas'
import { Modal } from './ui/Modal'
import { clases } from './ui/Basicos'

/**
 * De dónde sale la cifra grande del tablero.
 *
 * El número que manda ahí es lo que se puede gastar hoy, y es el resultado de
 * una división cuyos dos operandos estaban escondidos: el margen del ciclo vivía
 * en otra tarjeta que solo aparece con saldo declarado, y los días restantes en
 * ningún lado. Una cifra sin origen no se cree ni se usa.
 *
 * Los renglones en cero se muestran igual, atenuados: ver los ceros enseña la
 * fórmula. Ocultarlos deja la resta incompleta y el resultado vuelve a ser
 * mágico.
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
  const dinero = (c: number) => formatearMoneda(c, moneda, locale, { conDecimales: false })
  const ventana = esteCiclo(margen.ciclo.tipo)

  const renglones = [
    {
      etiqueta: margen.ingresosEstimados
        ? `Ingreso estimado ${delCiclo(margen.ciclo.tipo)}`
        : `Ingreso registrado ${delCiclo(margen.ciclo.tipo)}`,
      valor: margen.ingresos,
      signo: '',
      nota: margen.ingresosEstimados
        ? 'Sale de tu sueldo configurado. Todavía no registras el depósito.'
        : undefined,
    },
    { etiqueta: 'Gastos registrados', valor: -margen.egresos, signo: '−' },
    { etiqueta: 'Pagos de deuda por vencer', valor: -margen.compromisoDeuda, signo: '−' },
    { etiqueta: `Aporte a metas ${ventana}`, valor: -margen.compromisoMeta, signo: '−' },
  ]

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="De dónde sale ese número"
      descripcion={`Cuentas ${delCiclo(margen.ciclo.tipo)}, del ${formatearFechaCorta(margen.ciclo.inicio, locale)} al ${formatearFechaCorta(margen.ciclo.fin, locale)}.`}
      ancho="sm:max-w-md"
    >
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

      <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-borde-fuerte py-3">
        <p className="text-[15px] font-medium text-tinta">
          {margen.margenLibre >= 0 ? 'Te queda libre' : 'Vas por encima'}
        </p>
        <span
          className={clases(
            'cifras cifra-lg shrink-0 font-semibold',
            margen.margenLibre >= 0 ? 'text-tinta' : 'text-rojo',
          )}
        >
          {dinero(Math.abs(margen.margenLibre))}
        </span>
      </div>

      {margen.diasRestantes > 0 && margen.margenLibre > 0 && (
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

      {margen.colchonTotal !== null && (
        <p className="mt-4 text-[13px] leading-relaxed text-tenue">
          Aparte de esta cuenta tienes{' '}
          <span className="cifras font-medium text-suave">{dinero(margen.colchonTotal)}</span> de
          respaldo en tu saldo. No se reparte entre los días porque no es dinero de{' '}
          {ventana.replace('esta ', 'esta ').replace('este ', 'este ')}: es lo que llevas guardado.
        </p>
      )}
    </Modal>
  )
}
