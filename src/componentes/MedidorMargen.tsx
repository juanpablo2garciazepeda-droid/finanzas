import type { Margen } from '@/dominio/alertas'
import type { NivelAlerta, Veredicto } from '@/dominio/tipos'
import { ETIQUETA_NIVEL, ETIQUETA_NIVEL_GENERAL } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFechaCorta } from '@/dominio/fechas'
import { useFormato } from '@/estado/finanzas'
import { Punto, clases } from './ui/Basicos'

/**
 * El elemento firma de la app: responde "¿puedo gastar esto?" con un arco que
 * se llena en vivo conforme el usuario teclea el monto, el color del semáforo
 * y las razones concretas debajo.
 */

const RADIO = 76
const LONGITUD = Math.PI * RADIO

const TRAZO: Record<NivelAlerta, string> = {
  verde: 'stroke-verde',
  ambar: 'stroke-ambar',
  rojo: 'stroke-rojo',
}

const TEXTO: Record<NivelAlerta, string> = {
  verde: 'text-verde',
  ambar: 'text-ambar',
  rojo: 'text-rojo',
}

export function MedidorMargen({
  veredicto,
  margen,
  monto,
  compacto,
}: {
  veredicto: Veredicto
  margen: Margen
  /** Gasto que se está evaluando. Cero es la lectura general del mes. */
  monto: number
  compacto?: boolean
}) {
  const { moneda, locale } = useFormato()
  const simulacion = monto > 0

  // En modo general el arco muestra cuánto del margen ya se consumió del mes;
  // en simulación, cuánto se llevaría este gasto.
  const consumido = simulacion
    ? margen.margenLibre > 0
      ? Math.min(1, monto / margen.margenLibre)
      : 1
    : margen.balance > 0
      ? Math.min(1, 1 - Math.max(0, margen.margenLibre) / margen.balance)
      : 1

  // En el tablero la cifra grande es lo que se puede gastar HOY: es la decisión
  // que se toma varias veces al día. Lo que queda del ciclo va debajo, como
  // contexto. En simulación manda el margen que sobraría tras el gasto.
  const cifra = simulacion
    ? veredicto.margenDespues
    : margen.diasRestantes > 0
      ? margen.gastoDiarioSugerido
      : margen.margenLibre
  const nivel = veredicto.nivel
  const texto = formatearMoneda(cifra, moneda, locale, { conDecimales: false })

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 200 112" className={compacto ? 'w-44' : 'w-56'} role="img" aria-label={`Margen disponible: ${texto}`}>
          <path
            d={`M ${100 - RADIO} 100 A ${RADIO} ${RADIO} 0 0 1 ${100 + RADIO} 100`}
            fill="none"
            strokeWidth="13"
            strokeLinecap="round"
            className="stroke-hundida"
          />
          <path
            d={`M ${100 - RADIO} 100 A ${RADIO} ${RADIO} 0 0 1 ${100 + RADIO} 100`}
            fill="none"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={LONGITUD}
            strokeDashoffset={LONGITUD * (1 - consumido)}
            className={clases(TRAZO[nivel], 'transition-all duration-500 ease-out')}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center px-2">
          <p
            className={clases(
              'cifras max-w-full truncate font-semibold',
              // Una cifra larga se encoge en vez de salirse del arco.
              texto.length > 11 ? 'text-xl' : compacto ? 'text-2xl' : 'text-3xl',
              TEXTO[nivel],
            )}
          >
            {texto}
          </p>
          <p className="mt-0.5 text-xs text-suave">
            {simulacion
              ? 'te quedarían libres'
              : margen.diasRestantes > 0
                ? 'puedes gastar hoy'
                : `libres ${esteCiclo(margen.ciclo.tipo)}`}
          </p>
        </div>
      </div>

      <p className={clases('font-display font-semibold', compacto ? 'text-base' : 'text-lg', TEXTO[nivel])}>
        {simulacion ? ETIQUETA_NIVEL[nivel] : ETIQUETA_NIVEL_GENERAL[nivel]}
      </p>

      {!simulacion && margen.diasRestantes > 0 && (
        <p className="mt-1 text-center text-[13px] text-suave">
          {margen.margenLibre >= 0 ? 'Te quedan ' : 'Vas '}
          <span className="cifras font-medium text-tinta">
            {formatearMoneda(Math.abs(margen.margenLibre), moneda, locale, { conDecimales: false })}
          </span>
          {margen.margenLibre >= 0 ? ` ${delCiclo(margen.ciclo.tipo)}` : ' por encima'}. Cierra el{' '}
          {formatearFechaCorta(margen.ciclo.fin, locale)}, en {margen.diasRestantes}{' '}
          {margen.diasRestantes === 1 ? 'día' : 'días'}.
        </p>
      )}

      {veredicto.razones.length > 0 && (
        <ul className="mt-3 w-full space-y-2">
          {veredicto.razones.map((razon) => (
            <li key={razon.clave} className="flex items-start gap-2.5 text-sm leading-snug text-suave">
              <Punto nivel={razon.nivel} className="mt-1.5" />
              <span>{razon.texto}</span>
            </li>
          ))}
        </ul>
      )}

      {margen.ingresosEstimados && (
        <p className="mt-3 text-xs text-tenue">
          Todavía no registras ingresos {esteCiclo(margen.ciclo.tipo)}; estimé el margen con tu
          ingreso habitual.
        </p>
      )}
    </div>
  )
}

/** Versión de una línea para encabezados y listas. */
export function SemaforoEnLinea({ nivel, texto }: { nivel: NivelAlerta; texto: string }) {
  return (
    <span className={clases('inline-flex items-center gap-2 text-sm font-medium', TEXTO[nivel])}>
      <Punto nivel={nivel} />
      {texto}
    </span>
  )
}
