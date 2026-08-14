import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Download,
  Languages,
  Lock,
  Repeat,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import {
  ETIQUETA_NIVEL,
  calcularMargen,
  evaluarGasto,
  type ContextoFinanciero,
} from '@/dominio/alertas'
import { cicloDe } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { hoyISO, periodoDe, sumarDias } from '@/dominio/fechas'
import type { NivelAlerta } from '@/dominio/tipos'
import { Logotipo } from '@/componentes/Marca'
import { clases } from '@/componentes/ui/Basicos'

/**
 * Página pública: qué es Finanzas GZ y por qué vale la pena crear una cuenta.
 *
 * El héroe no es una captura de pantalla ni una lista de virtudes: es el
 * mecanismo de la app funcionando. Quien llega teclea un monto y recibe el
 * mismo veredicto —con las mismas razones— que recibiría con su cuenta abierta,
 * porque el cálculo lo hace `evaluarGasto`, el motor real, sobre un escenario
 * de ejemplo. Una demo que miente sobre lo que hace el producto se nota, y una
 * captura no deja probar nada.
 *
 * Lo único que se permite de más en toda la página es que el fondo del héroe se
 * tiña del color del veredicto. Es la idea entera de la app —verde, ámbar,
 * rojo— aplicada a la superficie en la que estás parado, y se mantiene a un 5 %
 * de opacidad para que acompañe la lectura sin competir con ella.
 */

// ── Escenario de ejemplo ────────────────────────────────────────────────────
//
// Las fechas se derivan del ciclo real de hoy y no de constantes: un escenario
// fijado a agosto de 2026 se vuelve mentira en septiembre, y la demo empezaría
// a decir "te quedan 0 días" sin que nadie lo note hasta que un visitante lo
// vea.

function construirEscenario(): ContextoFinanciero {
  const hoy = hoyISO()
  const ciclo = cicloDe(hoy, 'quincenal')
  const periodo = periodoDe(hoy)
  // Los gastos se reparten desde el arranque del ciclo hasta hoy para que el
  // historial se vea vivido y no todo el mismo día.
  const d = (n: number) => {
    const f = sumarDias(ciclo.inicio, n)
    return f > hoy ? hoy : f
  }

  return {
    hoy,
    periodo,
    ajustes: {
      id: 'unico',
      moneda: 'MXN',
      locale: 'es-MX',
      ingresoMensual: 1_800_000,
      cicloPago: 'quincenal',
      saldoInicial: 0,
      saldoInicialFecha: '',
      tema: 'sistema',
      acento: 'grafito',
      diasAvisoVencimiento: 7,
      umbralPrecaucion: 0.8,
      notificacionesActivas: false,
      ultimaRevisionVencimientos: '',
    },
    categorias: [
      { id: 'comida', nombre: 'Comida', tipo: 'egreso', icono: 'Utensils', color: '#BC670D', esSistema: true, archivada: false, orden: 0 },
      { id: 'super', nombre: 'Súper', tipo: 'egreso', icono: 'ShoppingCart', color: '#90790C', esSistema: true, archivada: false, orden: 1 },
      { id: 'transporte', nombre: 'Transporte', tipo: 'egreso', icono: 'Car', color: '#0F84D8', esSistema: true, archivada: false, orden: 2 },
      { id: 'sueldo', nombre: 'Sueldo', tipo: 'ingreso', icono: 'Briefcase', color: '#10924B', esSistema: true, archivada: false, orden: 3 },
    ],
    transacciones: [
      { id: 't0', tipo: 'ingreso', monto: 900_000, categoriaId: 'sueldo', fecha: ciclo.inicio, metodoPago: 'transferencia', nota: 'Quincena', creadoEn: '' },
      { id: 't1', tipo: 'egreso', monto: 124_000, categoriaId: 'super', fecha: d(1), metodoPago: 'debito', nota: 'Despensa', creadoEn: '' },
      { id: 't2', tipo: 'egreso', monto: 68_000, categoriaId: 'transporte', fecha: d(2), metodoPago: 'efectivo', nota: '', creadoEn: '' },
      { id: 't3', tipo: 'egreso', monto: 96_000, categoriaId: 'comida', fecha: d(3), metodoPago: 'debito', nota: '', creadoEn: '' },
      { id: 't4', tipo: 'egreso', monto: 89_000, categoriaId: 'comida', fecha: d(5), metodoPago: 'credito', nota: '', creadoEn: '' },
      { id: 't5', tipo: 'egreso', monto: 55_000, categoriaId: 'transporte', fecha: d(6), metodoPago: 'efectivo', nota: '', creadoEn: '' },
    ],
    presupuestos: [
      { id: 'p1', categoriaId: 'comida', montoLimite: 240_000, periodo },
    ],
    deudas: [
      {
        id: 'd1',
        acreedor: 'Tarjeta BBVA',
        montoOriginal: 1_800_000,
        saldoActual: 1_240_000,
        tasaInteres: 42,
        // Vence dentro del ciclo: por eso descuenta del margen.
        fechaLimite: ciclo.fin,
        periodicidad: 'mensual',
        pagoMinimo: 120_000,
        liquidada: false,
        creadoEn: '',
      },
    ],
    pagos: [],
    metas: [
      {
        id: 'm1',
        nombre: 'Fondo de emergencia',
        montoObjetivo: 3_000_000,
        montoActual: 640_000,
        fechaLimite: sumarDias(hoy, 300),
        prioridad: 1,
        aporteMensual: 160_000,
        icono: 'Shield',
        completada: false,
        creadoEn: '',
      },
    ],
    aportes: [],
  }
}

const MONTOS_RAPIDOS = [30_000, 85_000, 250_000]

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
const TINTE: Record<NivelAlerta, string> = {
  verde: 'var(--color-verde)',
  ambar: 'var(--color-ambar)',
  rojo: 'var(--color-rojo)',
}

export function Landing() {
  const ctx = useMemo(construirEscenario, [])
  const margen = useMemo(() => calcularMargen(ctx), [ctx])
  // Arranca en un monto que cabe. La demo tiene que enseñar primero que la app
  // sabe decir que sí; los chips de arriba dejan probar en dos toques que
  // también sabe decir que no, que es la parte que convence.
  const [monto, setMonto] = useState(30_000)

  const veredicto = useMemo(() => evaluarGasto(monto, 'comida', ctx), [monto, ctx])
  const dinero = (c: number) =>
    formatearMoneda(c, ctx.ajustes.moneda, ctx.ajustes.locale, { conDecimales: false })

  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />

      {/* ── Héroe ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        {/* El tinte del veredicto. `pointer-events-none` para que nunca se
            interponga entre el dedo y los controles que tiene encima. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-colors duration-700"
          style={{
            background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${TINTE[veredicto.nivel]} 9%, transparent) 0%, transparent 70%)`,
          }}
        />

        <div className="relative mx-auto max-w-5xl px-5 pt-12 pb-14 sm:px-8 sm:pt-20 sm:pb-20">
          <p className="text-[13px] font-medium tracking-wide text-acento uppercase">
            Finanzas personales
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.25rem,7.5vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.04em] text-tinta text-balance">
            Antes de gastar, pregúntale.
          </h1>
          <p className="mt-5 max-w-xl text-[clamp(1.0625rem,2.2vw,1.3125rem)] leading-relaxed text-suave text-pretty">
            Un saldo no te dice si puedes gastar. Finanzas GZ descuenta lo que ya
            debes, lo que estás ahorrando y los días que faltan para tu próximo
            cobro, y entonces sí responde.
          </p>

          {/* ── El instrumento ──────────────────────────────────────────── */}
          <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
              <label
                htmlFor="demo-monto"
                className="font-display text-[17px] font-semibold text-tinta"
              >
                ¿Me alcanza para…?
              </label>
              <p className="mt-1 text-[13px] text-tenue">
                Escenario de ejemplo: cobras cada quincena y vas a mitad de ella.
              </p>

              <div className="relative mt-4">
                <span className="cifras pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[22px] font-semibold text-tenue">
                  $
                </span>
                <input
                  id="demo-monto"
                  type="text"
                  inputMode="numeric"
                  value={(monto / 100).toLocaleString('es-MX')}
                  onChange={(e) => {
                    const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 7)
                    setMonto(Number(soloDigitos) * 100)
                  }}
                  aria-label="Monto a evaluar en pesos"
                  className="cifras w-full rounded-campo border border-borde bg-elevada py-3 pr-4 pl-9 text-[22px] font-semibold text-tinta transition-shadow focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {MONTOS_RAPIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonto(m)}
                    aria-pressed={monto === m}
                    className={clases(
                      'cifras rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                      monto === m
                        ? 'border-acento bg-acento text-sobre-acento'
                        : 'border-borde bg-elevada text-suave hover:bg-hundida hover:text-tinta',
                    )}
                  >
                    {dinero(m)}
                  </button>
                ))}
              </div>

              <dl className="mt-5 space-y-2 border-t border-borde pt-4 text-[13px]">
                {[
                  ['Entró esta quincena', dinero(margen.ingresos)],
                  ['Ya gastaste', `− ${dinero(margen.egresos)}`],
                  ['Pago de tarjeta que vence', `− ${dinero(margen.compromisoDeuda)}`],
                  ['Va a tu fondo de emergencia', `− ${dinero(margen.compromisoMeta)}`],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="flex items-baseline justify-between gap-3">
                    <dt className="text-suave">{etiqueta}</dt>
                    <dd className="cifras shrink-0 font-medium text-tinta">{valor}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-borde pt-2">
                  <dt className="font-medium text-tinta">Margen libre</dt>
                  <dd className="cifras shrink-0 font-semibold text-tinta">
                    {dinero(margen.margenLibre)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta sm:p-6">
              <MedidorDemo
                nivel={veredicto.nivel}
                fraccion={
                  margen.margenLibre > 0 ? Math.min(1, monto / margen.margenLibre) : 1
                }
                cifra={dinero(veredicto.margenDespues)}
                etiqueta="te quedarían libres"
                titular={ETIQUETA_NIVEL[veredicto.nivel]}
              />
              <ul className="mt-4 space-y-2.5 border-t border-borde pt-4">
                {veredicto.razones.map((razon) => (
                  <li
                    key={razon.clave}
                    className="flex items-start gap-2.5 text-[14px] leading-snug text-suave"
                  >
                    <span
                      aria-hidden
                      className={clases(
                        'mt-[6px] inline-block size-2 shrink-0 rounded-full',
                        razon.nivel === 'verde'
                          ? 'bg-verde'
                          : razon.nivel === 'ambar'
                            ? 'bg-ambar'
                            : 'bg-rojo',
                      )}
                    />
                    <span>{razon.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/crear-cuenta"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-acento px-6 py-3.5 text-[16px] font-medium text-sobre-acento transition-colors hover:bg-acento-hondo"
            >
              Crear cuenta
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/entrar"
              className="inline-flex items-center justify-center rounded-full border border-borde bg-superficie px-6 py-3.5 text-[16px] font-medium text-acento transition-colors hover:bg-elevada"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-tenue">
            Gratis. Sin tarjeta. Tus datos se exportan y se borran cuando quieras.
          </p>
        </div>
      </header>

      {/* ── La fórmula ──────────────────────────────────────────────────── */}
      <section className="border-y border-borde bg-superficie">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-18">
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-[-0.03em] text-tinta">
            El número que importa no es el saldo
          </h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-suave">
            Es el <strong className="font-medium text-tinta">margen libre</strong>: lo
            que de verdad puedes usar sin comprometer algo que ya prometiste.
            Esta es la cuenta completa, sin nada escondido.
          </p>

          <div className="mt-7 overflow-x-auto">
            <div className="inline-flex min-w-full items-stretch gap-2 text-[13px] sm:gap-3">
              {[
                { signo: '', etiqueta: 'Lo que entra en tu ciclo', tono: 'text-verde' },
                { signo: '−', etiqueta: 'Lo que ya gastaste', tono: 'text-suave' },
                { signo: '−', etiqueta: 'Deudas que vencen antes del corte', tono: 'text-suave' },
                { signo: '−', etiqueta: 'La parte de tus metas que toca ahora', tono: 'text-suave' },
                { signo: '=', etiqueta: 'Margen libre', tono: 'text-acento' },
              ].map(({ signo, etiqueta, tono }) => (
                <div key={etiqueta} className="flex items-stretch gap-2 sm:gap-3">
                  {signo && (
                    <span className="cifras flex items-center text-[20px] font-semibold text-tenue">
                      {signo}
                    </span>
                  )}
                  <div
                    className={clases(
                      'flex w-33 items-center rounded-campo border border-borde bg-elevada px-3 py-3 leading-snug sm:w-40',
                      tono,
                    )}
                  >
                    {etiqueta}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-suave">
            Y de ahí sale la cifra que preside el tablero:{' '}
            <strong className="font-medium text-tinta">cuánto puedes gastar hoy</strong>,
            que es el margen libre dividido entre los días que faltan para tu
            próximo corte. Si cobras por quincena, la cuenta es por quincena: nadie
            decide en la caja del súper pensando en el mes calendario.
          </p>
        </div>
      </section>

      {/* ── Qué trae ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-18">
        <h2 className="font-display text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-[-0.03em] text-tinta">
          Lo que lleva dentro
        </h2>
        <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              Icono: Wallet,
              titulo: 'Presupuestos por categoría',
              detalle:
                'Un tope por rubro y una comparación contra el mes pasado. El semáforo los toma en cuenta antes de darte luz verde.',
            },
            {
              Icono: CreditCard,
              titulo: 'Deudas con método',
              detalle:
                'Capturas el total y en cuántos pagos la liquidas; la app calcula la mensualidad y te ordena cuál conviene atacar primero.',
            },
            {
              Icono: Target,
              titulo: 'Metas que apartan dinero',
              detalle:
                'Eliges para cuándo la quieres y sale cuánto guardar al mes. Ese dinero deja de contar como gastable.',
            },
            {
              Icono: Repeat,
              titulo: 'Movimientos recurrentes',
              detalle:
                'La renta, Netflix y tu sueldo se registran solos el día que toca. No vuelves a capturar lo mismo cada mes.',
            },
            {
              Icono: CalendarClock,
              titulo: 'Avisos de vencimiento',
              detalle:
                'Te avisa de los pagos que se acercan y te manda un resumen semanal por correo si lo quieres.',
            },
            {
              Icono: Download,
              titulo: 'Exportar e importar',
              detalle:
                'Tus movimientos en CSV o PDF, y un respaldo completo en JSON. También puedes importar el estado de cuenta de tu banco.',
            },
          ].map(({ Icono, titulo, detalle }) => (
            <div key={titulo}>
              <Icono className="size-5 text-acento" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 font-display text-[17px] font-semibold text-tinta">
                {titulo}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-suave">{detalle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Confianza ───────────────────────────────────────────────────── */}
      <section className="border-t border-borde bg-superficie">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-18">
          <h2 className="font-display text-[clamp(1.5rem,3.5vw,2rem)] font-semibold tracking-[-0.03em] text-tinta">
            Tus datos, tuyos
          </h2>
          <div className="mt-7 grid gap-6 sm:grid-cols-3">
            {[
              {
                Icono: Lock,
                titulo: 'Cuenta con contraseña',
                detalle:
                  'Contraseñas guardadas con bcrypt, correo verificado y opción de cerrar la sesión en todos tus dispositivos.',
              },
              {
                Icono: Download,
                titulo: 'Te los puedes llevar',
                detalle:
                  'Un botón exporta todo lo tuyo en JSON. No hay dato al que tú no tengas acceso.',
              },
              {
                Icono: Trash2,
                titulo: 'Y los puedes borrar',
                detalle:
                  'Eliminar la cuenta borra de verdad: movimientos, deudas, metas y ajustes se van con ella.',
              },
            ].map(({ Icono, titulo, detalle }) => (
              <div key={titulo} className="flex gap-3">
                <Icono
                  className="mt-0.5 size-5 shrink-0 text-acento"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div>
                  <h3 className="text-[15px] font-semibold text-tinta">{titulo}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-suave">{detalle}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-7 flex items-center gap-2 text-[14px] text-tenue">
            <Languages className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Disponible en español e inglés, con tema claro y oscuro.
          </p>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-[clamp(1.75rem,4.5vw,2.75rem)] leading-tight font-semibold tracking-[-0.035em] text-tinta text-balance">
          La próxima vez que dudes en la caja, ya vas a saber.
        </h2>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/crear-cuenta"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-acento px-6 py-3.5 text-[16px] font-medium text-sobre-acento transition-colors hover:bg-acento-hondo sm:w-auto"
          >
            Crear cuenta
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to="/entrar"
            className="inline-flex w-full items-center justify-center rounded-full border border-borde bg-superficie px-6 py-3.5 text-[16px] font-medium text-acento transition-colors hover:bg-elevada sm:w-auto"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <footer className="border-t border-borde">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logotipo tamano={26} tamanoTexto={15} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-suave">
            <Link to="/aviso-privacidad" className="hover:text-tinta">
              Aviso de privacidad
            </Link>
            <Link to="/entrar" className="hover:text-tinta">
              Entrar
            </Link>
            <span className="text-tenue">© {new Date().getFullYear()} Finanzas GZ</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/** Barra superior de las pantallas públicas. */
export function BarraPublica() {
  return (
    <nav className="sticky top-0 z-30 border-b border-borde cristal">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3 sm:px-8">
        <Link to="/" aria-label="Inicio de Finanzas GZ">
          <Logotipo tamano={30} />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/entrar"
            className="rounded-full px-3.5 py-2 text-[14px] font-medium text-suave transition-colors hover:bg-elevada hover:text-tinta sm:px-4"
          >
            Entrar
          </Link>
          <Link
            to="/crear-cuenta"
            className="rounded-full bg-acento px-4 py-2 text-[14px] font-medium text-sobre-acento transition-colors hover:bg-acento-hondo"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </nav>
  )
}

/**
 * Arco del semáforo para la demo pública.
 *
 * Es un componente aparte y no `MedidorMargen` porque aquel lee la moneda del
 * contexto de finanzas, que solo existe con sesión iniciada. Reusarlo obligaría
 * a montar medio proveedor de datos en una página que no tiene usuario.
 */
function MedidorDemo({
  nivel,
  fraccion,
  cifra,
  etiqueta,
  titular,
}: {
  nivel: NivelAlerta
  fraccion: number
  cifra: string
  etiqueta: string
  titular: string
}) {
  const RADIO = 76
  const LONGITUD = Math.PI * RADIO
  const lleno = Math.min(1, Math.max(0, fraccion))

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg
          viewBox="0 0 200 112"
          className="w-52 max-w-full sm:w-56"
          role="img"
          aria-label={`${titular}. ${cifra} ${etiqueta}.`}
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
            strokeDashoffset={LONGITUD * (1 - lleno)}
            className={clases(TRAZO[nivel], 'transition-all duration-500 ease-out')}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center px-2">
          <p
            className={clases(
              'cifras max-w-full truncate font-semibold',
              cifra.length > 11 ? 'text-xl' : 'text-3xl',
              TEXTO[nivel],
            )}
          >
            {cifra}
          </p>
          <p className="mt-0.5 text-xs text-suave">{etiqueta}</p>
        </div>
      </div>
      <p className={clases('mt-1 font-display text-lg font-semibold', TEXTO[nivel])}>
        {titular}
      </p>
    </div>
  )
}
