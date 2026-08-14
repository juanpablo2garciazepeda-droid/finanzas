import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Mail, XCircle } from 'lucide-react'
import { Boton, Tarjeta } from '@/componentes/ui/Basicos'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'

/**
 * Pantalla a la que llega el usuario tras picar el enlace de verificación
 * en su correo. Leemos el `token` del query string y lo mandamos al backend.
 */
export function VerificarEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const { mostrar } = useAvisos()
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')
  const [mensaje, setMensaje] = useState('Verificando tu correo…')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (!token) {
      setEstado('error')
      setMensaje('Falta el token de verificación. Abre el enlace que te enviamos por correo.')
      return
    }
    void (async () => {
      const res = await api.post<{ user: { id: string; email: string; emailVerificado: boolean } }>(
        '/auth/verificar-email',
        { token },
      )
      if (res.ok && res.data) {
        setEstado('ok')
        setMensaje(`Listo, ${res.data.user.email} ya está verificada.`)
        // Si el usuario ya estaba logueado, refrescamos su estado de auth.
        await auth.refrescar()
        mostrar('Correo verificado')
        return
      }
      setEstado('error')
      setMensaje(res.error ?? 'No se pudo verificar el correo.')
    })()
  }, [location.search, auth, mostrar])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-fondo px-6 py-10">
      <Tarjeta className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center gap-3">
          {estado === 'cargando' && (
            <Mail className="size-10 text-acento" aria-hidden />
          )}
          {estado === 'ok' && (
            <CheckCircle2 className="size-10 text-verde" aria-hidden />
          )}
          {estado === 'error' && (
            <XCircle className="size-10 text-rojo" aria-hidden />
          )}
          <p className="text-[15px] text-tinta">{mensaje}</p>
        </div>
        {estado !== 'cargando' && (
          <div className="mt-4 space-y-2">
            {auth.autenticado ? (
              <Boton ancho onClick={() => navigate('/ajustes')}>
                Ir a mi cuenta
              </Boton>
            ) : (
              <>
                <Boton ancho onClick={() => navigate('/')}>
                  Iniciar sesión
                </Boton>
                <Boton
                  ancho
                  variante="fantasma"
                  onClick={async () => {
                    const email = prompt('Tu correo:')
                    if (!email) return
                    const res = await api.post('/auth/reenviar-verificacion', { email })
                    mostrar(res.ok ? 'Te enviamos un nuevo correo' : (res.error ?? 'No se pudo reenviar'))
                  }}
                >
                  Reenviar correo de verificación
                </Boton>
              </>
            )}
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
