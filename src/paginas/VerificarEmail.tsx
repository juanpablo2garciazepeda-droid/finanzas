import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CircleCheckBig, CircleX, Mail } from 'lucide-react'
import { Boton } from '@/componentes/ui/Basicos'
import { BarraPublica } from './Landing'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'

/**
 * Destino del enlace de verificación del correo.
 *
 * Sirve para dos cosas distintas que llegan por la misma puerta:
 *   · confirmar la cuenta recién creada, y
 *   · confirmar un cambio de correo (`?cambio=1&correo=…`).
 *
 * El canje se hace UNA vez por token. Antes el efecto dependía del objeto
 * `auth`, que se recreaba en cada render, así que la pantalla reenviaba el
 * token en bucle: el primer intento lo quemaba y los siguientes devolvían
 * "no es válido", con lo que una verificación correcta terminaba mostrando un
 * error. El candado de abajo es lo que lo impide.
 */
export function VerificarEmail() {
  const location = useLocation()
  const navegar = useNavigate()
  const auth = useAuth()

  const { token, nuevoEmail } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return {
      token: p.get('token') ?? '',
      nuevoEmail: p.get('cambio') === '1' ? (p.get('correo') ?? undefined) : undefined,
    }
  }, [location.search])

  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')
  const [mensaje, setMensaje] = useState('Confirmando tu correo…')
  const canjeado = useRef<string | null>(null)

  useEffect(() => {
    if (!token) {
      setEstado('error')
      setMensaje('Este enlace viene incompleto. Ábrelo tal como llegó en el correo.')
      return
    }
    if (canjeado.current === token) return
    canjeado.current = token

    void (async () => {
      const res = await api.post<{
        user: { email: string }
        cambioAplicado: boolean
      }>('/auth/verificar-email', { token, ...(nuevoEmail ? { nuevoEmail } : {}) })

      if (!res.ok || !res.data) {
        setEstado('error')
        setMensaje(
          res.error ??
            'No pudimos confirmar el correo. El enlace pudo vencer o ya haberse usado.',
        )
        return
      }

      setEstado('ok')
      setMensaje(
        res.data.cambioAplicado
          ? `Listo. Tu cuenta ahora usa ${res.data.user.email}.`
          : `Listo. ${res.data.user.email} quedó confirmado.`,
      )
      // Si ya había sesión abierta, que el estado refleje el cambio sin
      // obligar a recargar.
      if (auth.autenticado) await auth.refrescar()
    })()
    // `auth` queda fuera a propósito: se usa solo dentro del efecto y basta
    // con el candado de `canjeado` para que corra una vez por token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, nuevoEmail])

  const ICONO = {
    cargando: <Mail className="size-7 text-acento" strokeWidth={1.75} aria-hidden />,
    ok: <CircleCheckBig className="size-7 text-verde" strokeWidth={1.75} aria-hidden />,
    error: <CircleX className="size-7 text-rojo" strokeWidth={1.75} aria-hidden />,
  }
  const FONDO = {
    cargando: 'bg-acento/12',
    ok: 'bg-verde/12',
    error: 'bg-rojo/12',
  }
  const TITULO = {
    cargando: 'Un momento',
    ok: 'Correo confirmado',
    error: 'No se pudo confirmar',
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />

      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <div className="rounded-tarjeta bg-superficie p-6 text-center shadow-tarjeta sm:p-8">
          <span
            className={`mx-auto flex size-14 items-center justify-center rounded-[16px] ${FONDO[estado]}`}
          >
            {ICONO[estado]}
          </span>
          <h1 className="mt-4 font-display text-[clamp(1.375rem,4.5vw,1.625rem)] font-semibold tracking-[-0.03em] text-tinta">
            {TITULO[estado]}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-suave">{mensaje}</p>

          {estado !== 'cargando' && (
            <div className="mt-6 space-y-2.5">
              {auth.autenticado ? (
                <Boton ancho onClick={() => navegar('/')}>
                  Ir a mi tablero
                </Boton>
              ) : estado === 'ok' ? (
                <Boton ancho onClick={() => navegar('/entrar')}>
                  Iniciar sesión
                </Boton>
              ) : (
                <>
                  <Boton ancho onClick={() => navegar('/crear-cuenta')}>
                    Pedir un código nuevo
                  </Boton>
                  <Boton variante="fantasma" ancho onClick={() => navegar('/entrar')}>
                    Volver a iniciar sesión
                  </Boton>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
