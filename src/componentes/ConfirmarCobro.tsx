import { useState } from 'react'
import { HandCoins } from 'lucide-react'
import type { Margen } from '@/dominio/alertas'
import { esteCiclo } from '@/dominio/ciclos'
import { formatearMoneda } from '@/dominio/dinero'
import { formatearFechaCorta, hoyISO } from '@/dominio/fechas'
import { crearTransaccion } from '@/datos/repositorio'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { Boton, Tarjeta } from './ui/Basicos'

/**
 * "¿Ya cobraste?".
 *
 * Mientras no haya un ingreso registrado en el ciclo, el margen se calcula con
 * una estimación del sueldo. Eso mantiene la app útil el día 1, pero es dinero
 * que quizá todavía no está en la cuenta, y confundirlo con dinero real es
 * exactamente lo que hace que los números "no cuadren". Así que se pregunta, y
 * la respuesta convierte la estimación en un movimiento de verdad.
 *
 * Las dos respuestas cuentan. "Sí" registra el ingreso; "todavía no" hace que
 * el estimado deje de repartirse como si fuera gastable. Antes esa segunda
 * respuesta solo escondía la tarjeta y las cuentas seguían igual de optimistas,
 * que era justo lo que la pregunta pretendía evitar.
 */
export function ConfirmarCobro({ margen }: { margen: Margen }) {
  const { categoriasActivas, ajustes, hoy, refrescar, cicloSinCobrar, aplazarCobro } = useFinanzas()
  const { mostrar } = useAvisos()
  const [guardando, setGuardando] = useState(false)
  const aplazado = cicloSinCobrar === margen.ciclo.inicio

  // Solo tiene sentido si hay un sueldo configurado y aún no se registró nada.
  const procede = margen.ingresosEstimados && margen.ingresos > 0 && !aplazado
  if (!procede) return null

  const categoriaIngreso =
    categoriasActivas.find((c) => c.tipo === 'ingreso' && /sueldo|n[oó]mina/i.test(c.nombre)) ??
    categoriasActivas.find((c) => c.tipo === 'ingreso')

  const texto = formatearMoneda(margen.ingresos, ajustes.moneda, ajustes.locale, {
    conDecimales: 'auto',
  })

  async function registrar() {
    if (!categoriaIngreso) {
      mostrar('Necesitas una categoría de ingreso para registrarlo', 'error')
      return
    }
    setGuardando(true)
    try {
      await crearTransaccion({
        tipo: 'ingreso',
        monto: margen.ingresos,
        categoriaId: categoriaIngreso.id,
        fecha: hoy || hoyISO(),
        metodoPago: 'transferencia',
        nota: 'Cobro registrado desde el tablero',
      })
      await refrescar()
      mostrar(`Listo, ${texto} entraron a tu ${margen.ciclo.nombre}`)
    } catch {
      mostrar('No se pudo registrar tu cobro', 'error')
    } finally {
      setGuardando(false)
    }
  }

  function aplazar() {
    aplazarCobro(margen.ciclo.inicio)
  }

  return (
    <Tarjeta className="animar-entrada flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento-suave">
        <HandCoins className="size-5 text-acento" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[17px] font-semibold text-tinta">¿Ya cobraste?</p>
        <p className="mt-0.5 text-[15px] text-suave">
          {/* Con una plantilla de ingreso recurrente no es una estimación: se
              sabe el monto y el día. Llamarla "estimado" ahí resta confianza a
              un dato que la persona misma configuró. */}
          {margen.fechaProximoCobro ? (
            <>
              Estoy calculando {esteCiclo(margen.ciclo.tipo)} contando los {texto} que caen el{' '}
              {formatearFechaCorta(margen.fechaProximoCobro, ajustes.locale)}. Si ya cayeron,
              regístralos y dejan de ser una proyección.
            </>
          ) : (
            <>
              Estoy calculando {esteCiclo(margen.ciclo.tipo)} con {texto} estimados de tu sueldo. Si
              ya cayeron, regístralos y los números pasan a ser reales.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Boton variante="secundario" onClick={aplazar}>
          Todavía no
        </Boton>
        <Boton onClick={() => void registrar()} disabled={guardando}>
          {guardando ? 'Registrando…' : `Sí, ${texto}`}
        </Boton>
      </div>
    </Tarjeta>
  )
}
