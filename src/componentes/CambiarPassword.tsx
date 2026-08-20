import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Boton, Campo, Entrada } from './ui/Basicos'
import { useAvisos } from '@/estado/avisos'
import { api } from '@/api/cliente'
import { useT } from '@/estado/i18n'

/**
 * Modal para cambiar la contraseña. Validación local de la política (8+
 * caracteres con minúscula, mayúscula y dígito) antes de mandar al servidor,
 * para no gastar una request si el formulario es inválido.
 */
export function CambiarPassword({
  onCerrar,
  onGuardado,
}: {
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { mostrar } = useAvisos()
  const t = useT()
  const [actual, setActual] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarPw, setMostrarPw] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cumple = nuevo.length >= 8 && /[a-z]/.test(nuevo) && /[A-Z]/.test(nuevo) && /[0-9]/.test(nuevo)
  const coinciden = confirmar.length === 0 || confirmar === nuevo
  const listo = actual.length > 0 && cumple && nuevo === confirmar

  async function guardar() {
    if (!listo) return
    setGuardando(true)
    const res = await api.patch('/auth/password', { actual, nuevo })
    setGuardando(false)
    if (!res.ok) {
      mostrar(res.error ?? t('aviso.no_password'), 'error')
      return
    }
    onGuardado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t('ajustes.cambiar_password')}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <Campo etiqueta={t('ajustes.password_actual')} htmlFor="actual">
          <div className="relative">
            <Entrada
              id="actual"
              type={mostrarPw ? 'text' : 'password'}
              autoFocus
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setMostrarPw(!mostrarPw)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-tenue hover:text-tinta"
              aria-label={t(mostrarPw ? 'ajustes.ocultar_passwords' : 'ajustes.mostrar_passwords')}
            >
              {mostrarPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Campo>
        <Campo
          etiqueta={t('ajustes.password_nueva')}
          htmlFor="nuevo"
          ayuda={t('ajustes.password_politica')}
          error={nuevo.length > 0 && !cumple ? t('ajustes.password_no_cumple') : undefined}
        >
          <Entrada
            id="nuevo"
            type={mostrarPw ? 'text' : 'password'}
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            required
          />
        </Campo>
        <Campo
          etiqueta={t('ajustes.password_repite')}
          htmlFor="confirmar"
          error={!coinciden ? t('ajustes.password_no_coincide') : undefined}
        >
          <Entrada
            id="confirmar"
            type={mostrarPw ? 'text' : 'password'}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </Campo>
        <p className="text-[13px] text-tenue">{t('ajustes.password_aviso_sesiones')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Boton>
          <Boton type="submit" disabled={!listo || guardando}>
            {guardando ? t('comun.guardando') : t('comun.guardar')}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
