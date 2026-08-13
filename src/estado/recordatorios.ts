import { useEffect } from 'react'
import { formatearMoneda } from '@/dominio/dinero'
import { fechaRelativa } from '@/dominio/fechas'
import { proximosVencimientos } from '@/dominio/deudas'
import { guardarAjustes } from '@/datos/repositorio'
import { useFinanzas } from './finanzas'

/**
 * Recordatorios de pagos próximos.
 *
 * Sin servidor no hay push real: la notificación se dispara la primera vez que
 * abres la app cada día. Es una limitación honesta de una app que vive solo en
 * el navegador, y la pantalla de ajustes lo dice con estas mismas palabras.
 */

export function hayNotificaciones(): boolean {
  return typeof Notification !== 'undefined'
}

export async function pedirPermiso(): Promise<boolean> {
  if (!hayNotificaciones()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function useRecordatorios() {
  const { ajustes, deudas, hoy, cargando } = useFinanzas()

  useEffect(() => {
    if (cargando || !ajustes.notificacionesActivas) return
    if (!hayNotificaciones() || Notification.permission !== 'granted') return
    // Una sola vez al día: nadie quiere el mismo aviso en cada recarga.
    if (ajustes.ultimaRevisionVencimientos === hoy) return

    const vencimientos = proximosVencimientos(deudas, hoy, ajustes.diasAvisoVencimiento)
    void guardarAjustes({ ultimaRevisionVencimientos: hoy })
    if (vencimientos.length === 0) return

    const primero = vencimientos[0]
    const monto = formatearMoneda(primero.monto, ajustes.moneda, ajustes.locale, { conDecimales: false })
    const cuerpo =
      vencimientos.length === 1
        ? `${monto} a ${primero.deuda.acreedor} ${fechaRelativa(hoy, primero.fecha)}.`
        : `${monto} a ${primero.deuda.acreedor} ${fechaRelativa(hoy, primero.fecha)}, y ${vencimientos.length - 1} pago(s) más esta semana.`

    new Notification('Tienes un pago cerca', { body: cuerpo, tag: 'margen-vencimientos' })
  }, [cargando, ajustes, deudas, hoy])
}
