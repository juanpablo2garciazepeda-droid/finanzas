import { useState, type FormEvent } from 'react'
import { Modal } from './ui/Modal'
import { Boton, Campo, Entrada } from './ui/Basicos'
import { useAvisos } from '@/estado/avisos'
import { api } from '@/api/cliente'
import { useT } from '@/estado/i18n'

/**
 * Modal para iniciar el cambio de correo. No cambia el correo de inmediato:
 * envía un enlace de verificación al nuevo correo, y el cambio se confirma
 * al abrir ese enlace (mismo flujo que el registro inicial).
 */
export function CambiarCorreo({
  correoActual,
  onCerrar,
  onEnviado,
}: {
  correoActual: string
  onCerrar: () => void
  onEnviado: () => void
}) {
  const { mostrar } = useAvisos()
  const t = useT()
  const [nuevo, setNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const listo = /\S+@\S+\.\S+/.test(nuevo) && nuevo.toLowerCase() !== correoActual.toLowerCase()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!listo) return
    setEnviando(true)
    const res = await api.post<{ mensaje: string }>('/auth/cambiar-correo', {
      nuevoEmail: nuevo.trim(),
    })
    setEnviando(false)
    if (!res.ok) {
      mostrar(res.error ?? t('aviso.no_cambio_correo'), 'error')
      return
    }
    onEnviado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t('ajustes.cambiar_correo')}>
      <p className="text-[14px] text-suave">{t('ajustes.cambiar_correo_detalle')}</p>
      <form onSubmit={enviar} className="mt-4 space-y-4">
        <Campo etiqueta={t('ajustes.correo_actual')} htmlFor="correo-actual">
          <Entrada id="correo-actual" type="email" value={correoActual} disabled />
        </Campo>
        <Campo etiqueta={t('ajustes.correo_nuevo')} htmlFor="correo-nuevo">
          <Entrada
            id="correo-nuevo"
            type="email"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder={t('ajustes.correo_placeholder')}
            autoComplete="email"
            required
          />
        </Campo>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Boton>
          <Boton type="submit" disabled={!listo || enviando}>
            {enviando ? t('ajustes.enviando') : t('ajustes.enviar_enlace')}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
