import { useState } from 'react'
import { Info } from 'lucide-react'
import type { Margen } from '@/dominio/alertas'
import type { NivelAlerta, Veredicto } from '@/dominio/tipos'
import { ETIQUETA_NIVEL, ETIQUETA_NIVEL_GENERAL } from '@/dominio/alertas'
import { delCiclo, esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFechaCorta } from '@/dominio/fechas'
import { useFormato } from '@/estado/finanzas'
import { DesgloseMargen } from './DesgloseMargen'
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
  const [desglose, setDesglose] = useState(false)
  const simulacion = monto > 0

  // En modo general el arco muestra cuánto del flujo del ciclo ya se consumió;
  // en simulación, cuánto se llevaría este gasto.
  const consumido = simulacion
    ? margen.margenDisponible > 0
      ? Math.min(1, monto / margen.margenDisponible)
      : 1
    : margen.flujoDelCiclo > 0
      ? Math.min(1, 1 - Math.max(0, margen.margenDisponible) / margen.flujoDelCiclo)
      : 1

  // En el tablero la cifra grande es lo que se puede gastar HOY: es la decisión
  // que se toma varias veces al día. Lo que queda del ciclo va debajo, como
  // contexto. En simulación manda el margen que sobraría tras el gasto.
  const porDia = !simulacion && margen.diasRestantes > 0
  // En simulación, cuando el techo lo pone la caja, la cifra ES el saldo que
  // queda en la cuenta y la etiqueta puede decirlo con esas palabras. Cuando
  // el techo es otro, la cifra es margen del ciclo y llamarla "en la cuenta"
  // era el letrero que convertía −$5,146 de margen en un saldo bancario que
  // nadie tenía.
  const enCuenta = simulacion && margen.tope === 'caja' && margen.efectivoHoy !== null
  const cifra = simulacion
    ? enCuenta
      ? margen.efectivoHoy! - monto
      : veredicto.margenDespues
    : porDia
      ? margen.gastoDiarioSugerido
      : margen.margenLibre
  const nivel = veredicto.nivel
  // "tu quincena" / "tu semana" / "tu sueldo": nombrar el cobro por su ciclo.
  const cobro = margen.ciclo.tipo === 'mensual' ? 'sueldo' : margen.ciclo.nombre
  // Los centavos aparecen solo si existen: $3.50 no puede leerse como $4.
  const texto = formatearMoneda(cifra, moneda, locale, { conDecimales: 'auto' })
  const dinero = (c: number) => formatearMoneda(c, moneda, locale, { conDecimales: 'auto' })

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* `max-w-full`: el ancho fijo del arco no cabe en pantallas muy
            angostas y ahí prefiere encogerse a salirse. */}
        <svg
          viewBox="0 0 200 112"
          className={clases('max-w-full', compacto ? 'w-44' : 'w-56')}
          role="img"
          aria-label={`Margen disponible: ${texto}`}
        >
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
              'cifras flex max-w-full items-baseline justify-center gap-0.5 font-semibold',
              // Una cifra larga se encoge en vez de salirse del arco.
              texto.length > 11 ? 'text-xl' : compacto ? 'text-2xl' : 'text-3xl',
              TEXTO[nivel],
            )}
          >
            <span className="truncate">{texto}</span>
            {/* La unidad va pegada al número, no como pie de foto: "2,833" y
                "2,833 al día" son consejos distintos, y la etiqueta de 12 px
                debajo se la saltaba todo el mundo. */}
            {porDia && <span className="text-[0.42em] font-medium opacity-80">/día</span>}
          </p>
          <p className="mt-0.5 text-xs text-suave">
            {simulacion
              ? enCuenta
                ? 'te quedarían en la cuenta'
                : 'te quedarían libres'
              : porDia
                ? 'puedes gastar hoy'
                : `libres ${esteCiclo(margen.ciclo.tipo)}`}
          </p>
        </div>
      </div>

      <p className={clases('font-display font-semibold', compacto ? 'text-base' : 'text-lg', TEXTO[nivel])}>
        {simulacion ? ETIQUETA_NIVEL[nivel] : ETIQUETA_NIVEL_GENERAL[nivel]}
      </p>

      {/* La aritmética completa, siempre visible. Antes esto vivía en otra
          tarjeta que solo aparecía con saldo declarado: en cuenta nueva la cifra
          grande salía de la nada. */}
      {porDia && margen.margenDisponible > 0 && (
        <button
          type="button"
          onClick={() => setDesglose(true)}
          className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-campo px-2 py-1 text-center text-[13px] text-suave transition-colors hover:bg-elevada"
        >
          <span>
            <span className="cifras font-medium text-tinta">
              {dinero(margen.margenDisponible)}
            </span>{' '}
            libres
          </span>
          <span>
            ÷{' '}
            <span className="cifras font-medium text-tinta">
              {margen.diasRestantes} {margen.diasRestantes === 1 ? 'día' : 'días'}
            </span>
          </span>
          <span>
            = <span className="cifras font-medium text-tinta">{dinero(margen.gastoDiarioSugerido)}</span>{' '}
            al día
          </span>
          <Info className="size-3.5 shrink-0 text-tenue" aria-hidden />
        </button>
      )}

      {porDia && margen.margenDisponible <= 0 && (
        <button
          type="button"
          onClick={() => setDesglose(true)}
          className="mt-1.5 flex items-center gap-1.5 rounded-campo px-2 py-1 text-center text-[13px] text-suave transition-colors hover:bg-elevada"
        >
          {/* Cada tope tiene su explicación y son tres cosas distintas: no
              tener el dinero, no alcanzar para lo comprometido, y haber
              gastado más de lo que entró. Dar la equivocada es lo que hace
              que el número parezca sacado de la manga. */}
          <span>
            {margen.tope === 'caja' ? (
              <>
                Tu cuenta trae{' '}
                <span className="cifras font-medium text-rojo">
                  {dinero(margen.efectivoHoy ?? 0)}
                </span>{' '}
                {margen.cobroPendiente || margen.ingresosEstimados
                  ? `y tu ${cobro} todavía no cae`
                  : 'y ya está comprometida'}
              </>
            ) : margen.tope === 'compromisos' ? (
              <>
                Te faltan{' '}
                <span className="cifras font-medium text-rojo">
                  {dinero(Math.abs(margen.margenDisponible))}
                </span>{' '}
                para lo que ya está comprometido {esteCiclo(margen.ciclo.tipo)}
              </>
            ) : (
              <>
                Vas{' '}
                <span className="cifras font-medium text-rojo">
                  {dinero(Math.abs(margen.margenDisponible))}
                </span>{' '}
                por encima de lo que entró {esteCiclo(margen.ciclo.tipo)}
              </>
            )}
          </span>
          <Info className="size-3.5 shrink-0 text-tenue" aria-hidden />
        </button>
      )}

      {porDia && (
        <p className="mt-1 text-center text-[13px] text-tenue">
          Cierra el {formatearFechaCorta(margen.ciclo.fin, locale)}
          {/* Con qué se cierra el ciclo, ya contando el cobro que falta y lo
              comprometido. Antes aquí iba "de respaldo" el colchón, que resta
              compromisos de la caja sin sumar el cobro: en la primera semana
              de la quincena esa cifra sale negativa aunque el ciclo cierre
              con dinero de sobra. */}
          {margen.proyeccionCierre !== null && (
            <>
              {' · '}
              cerrarías con{' '}
              <span
                className={clases(
                  'cifras',
                  margen.proyeccionCierre >= 0 ? 'text-suave' : 'text-rojo',
                )}
              >
                {dinero(margen.proyeccionCierre)}
              </span>
            </>
          )}
        </p>
      )}

      {!porDia && !simulacion && (
        <p className="mt-1 text-center text-[13px] text-suave">
          {margen.margenLibre >= 0 ? 'Te quedaron ' : 'Cerraste '}
          <span className="cifras font-medium text-tinta">
            {dinero(Math.abs(margen.margenLibre))}
          </span>
          {margen.margenLibre >= 0 ? ` ${delCiclo(margen.ciclo.tipo)}` : ' por encima'}.
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

      <DesgloseMargen abierto={desglose} onCerrar={() => setDesglose(false)} margen={margen} />
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
