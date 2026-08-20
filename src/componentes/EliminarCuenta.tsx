import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Boton, Campo, Entrada } from './ui/Basicos'
import { useAvisos } from '@/estado/avisos'
import { useAuth } from '@/estado/auth'
import { api } from '@/api/cliente'
import { useT } from '@/estado/i18n'

/**
 * Modal de eliminación de cuenta. Pide contraseña + el texto literal
 * "ELIMINAR" como doble confirmación: nada de un click accidental.
 *
 * Al confirmar, cierra sesión automáticamente (`onEliminado` se ocupa de
 * eso en el padre) y el backend borra en cascada las categorías,
 * movimientos, deudas, metas y ajustes del usuario.
 */
export function EliminarCuenta({
  onCerrar,
  onEliminado,
}: {
  onCerrar: () => void
  onEliminado: () => void
}) {
  const { cerrarSesion } = useAuth()
  const { mostrar } = useAvisos()
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const listo = password.length > 0 && confirmar === 'ELIMINAR'

  async function eliminar() {
    if (!listo) return
    setEliminando(true)
    const res = await api.delete<{ mensaje: string }>('/auth/cuenta', { password })
    setEliminando(false)
    if (!res.ok) {
      mostrar(res.error ?? t('aviso.no_eliminar_cuenta'), 'error')
      return
    }
    onEliminado()
    cerrarSesion()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t('ajustes.eliminar_titulo')} ancho="sm:max-w-sm">
      <p className="text-[14px] text-suave">
        {t('ajustes.eliminar_detalle')} {t('ajustes.eliminar_irreversible')}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void eliminar()
        }}
        className="mt-4 space-y-4"
      >
        <Campo etiqueta={t('ajustes.tu_password')} htmlFor="pw-eliminar">
          <Entrada
            id="pw-eliminar"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </Campo>
        <Campo
          etiqueta={t('ajustes.escribe_eliminar')}
          htmlFor="confirmar-eliminar"
          error={
            confirmar.length > 0 && confirmar !== 'ELIMINAR'
              ? t('ajustes.debe_ser_eliminar')
              : undefined
          }
        >
          <Entrada
            id="confirmar-eliminar"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </Campo>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Boton>
          <Boton variante="peligro" type="submit" disabled={!listo || eliminando}>
            <Trash2 className="size-4" aria-hidden />
            {eliminando ? t('ajustes.eliminando') : t('ajustes.eliminar_definitivo')}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
