import { useState, type FormEvent } from 'react'
import {
  Camera,
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { Modal } from './ui/Modal'
import { Boton, Campo, Entrada, clases } from './ui/Basicos'
import { Avatar } from './Avatar'
import { EditorFotoPerfil } from './EditorFotoPerfil'
import { CambiarPassword } from './CambiarPassword'
import { CambiarCorreo } from './CambiarCorreo'
import { EliminarCuenta } from './EliminarCuenta'
import { useAvisos } from '@/estado/avisos'
import { useAuth } from '@/estado/auth'
import { api } from '@/api/cliente'
import { useT } from '@/estado/i18n'

/**
 * Hub de "Editar perfil": una sola pantalla con todo lo que tiene que
 * ver con la cuenta del usuario.
 *
 * Estructura en secciones (de menos a más sensible):
 *   - PERFIL:        avatar, nombre, correo
 *   - SEGURIDAD:     contraseña, cerrar sesión en todos lados
 *   - SESIÓN:        cerrar la sesión actual
 *   - ZONA PELIGROSA: eliminar la cuenta
 *
 * Cada acción de seguridad abre su propio modal encima. El modal raíz
 * permanece debajo, así si cancelas una acción sigues exactamente donde
 * estabas (no se cierra la vista de perfil por accidente).
 */
export function EditorPerfil({
  onCerrar,
}: {
  onCerrar: () => void
}) {
  const t = useT()
  const { usuario, refrescar, cerrarSesion } = useAuth()
  const { mostrar } = useAvisos()

  const [nombre, setNombre] = useState(usuario?.displayName ?? '')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [editorFotoAbierto, setEditorFotoAbierto] = useState(false)
  const [quitandoFoto, setQuitandoFoto] = useState(false)
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false)
  const [confirmandoLogoutAll, setConfirmandoLogoutAll] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [reenviandoVerificacion, setReenviandoVerificacion] = useState(false)

  if (!usuario) return null

  const nombreCambio = nombre.trim() !== '' && nombre.trim() !== usuario.displayName

  async function guardarNombre(e: FormEvent) {
    e.preventDefault()
    if (!nombreCambio || guardandoNombre) return
    setGuardandoNombre(true)
    const res = await api.patch<{ user: { displayName: string } }>('/auth/perfil', {
      displayName: nombre.trim(),
    })
    setGuardandoNombre(false)
    if (!res.ok) {
      mostrar(res.error ?? t('aviso.no_guardar'), 'error')
      return
    }
    await refrescar()
    mostrar(t('aviso.nombre_actualizado'))
  }

  return (
    <>
      <Modal abierto onCerrar={onCerrar} titulo={t('ajustes.editar_perfil_titulo')}>
        <form
          id="perfil-form"
          onSubmit={guardarNombre}
          className="space-y-6"
        >
          {/* ── PERFIL ─────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-tenue">
              {t('ajustes.seccion_perfil')}
            </h3>

            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setEditorFotoAbierto(true)}
                className="group relative rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-acento/30"
                aria-label={t('ajustes.cambiar_foto')}
              >
                <Avatar
                  nombre={usuario.displayName || usuario.email || '?'}
                  foto={usuario.fotoUrl}
                  tamano="xl"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <Camera className="size-7 text-white" />
                </span>
              </button>

              <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                <button
                  type="button"
                  onClick={() => setEditorFotoAbierto(true)}
                  className="rounded-md px-3 py-1.5 text-[13px] font-medium text-acento transition-colors hover:bg-acento/10"
                >
                  {usuario.fotoUrl ? t('ajustes.cambiar_foto') : t('ajustes.poner_foto')}
                </button>
                {usuario.fotoUrl && (
                  <>
                    <span className="text-tenue" aria-hidden>·</span>
                    <button
                      type="button"
                      onClick={() => setQuitandoFoto(true)}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium text-rojo transition-colors hover:bg-rojo/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      {t('ajustes.quitar_foto')}
                    </button>
                  </>
                )}
              </div>
            </div>

            <Campo etiqueta={t('ajustes.campo_nombre')} htmlFor="editar-nombre">
              <div className="relative">
                <User
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
                  aria-hidden
                />
                <Entrada
                  id="editar-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={80}
                  className={clases('pl-9', guardandoNombre && 'opacity-60')}
                />
              </div>
            </Campo>

            <Campo etiqueta={t('ajustes.campo_correo')} ayuda={t('ajustes.correo_ayuda_cuenta')} htmlFor="editar-correo">
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue"
                  aria-hidden
                />
                <Entrada
                  id="editar-correo"
                  type="email"
                  value={usuario.email}
                  disabled
                  className="pl-9"
                />
              </div>
              {!usuario.emailVerificado && (
                <button
                  type="button"
                  disabled={reenviandoVerificacion}
                  onClick={async () => {
                    setReenviandoVerificacion(true)
                    const res = await api.post('/auth/reenviar-verificacion', {
                      email: usuario.email,
                    })
                    setReenviandoVerificacion(false)
                    mostrar(
                      res.ok
                        ? t('aviso.verificacion_reenviada')
                        : (res.error ?? t('aviso.no_reenviar')),
                    )
                  }}
                  className="mt-1 text-[12px] text-acento transition-colors hover:underline disabled:opacity-50"
                >
                  {reenviandoVerificacion
                    ? t('ajustes.enviando')
                    : t('ajustes.reenviar_verificacion')}
                </button>
              )}
            </Campo>
          </section>

          {/* ── SEGURIDAD ──────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-tenue">
              {t('ajustes.seccion_seguridad')}
            </h3>
            <div className="overflow-hidden rounded-tarjeta border border-borde">
              <button
                type="button"
                onClick={() => setCambiandoPassword(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-elevada"
              >
                <KeyRound className="size-4 text-suave" aria-hidden />
                <span className="flex-1 text-tinta">{t('ajustes.cambiar_password')}</span>
                <ChevronRight className="size-4 text-suave" aria-hidden />
              </button>
              <div className="h-px bg-borde" />
              <button
                type="button"
                onClick={() => setCambiandoCorreo(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-elevada"
              >
                <Mail className="size-4 text-suave" aria-hidden />
                <span className="flex-1 text-tinta">{t('ajustes.cambiar_correo')}</span>
                <ChevronRight className="size-4 text-suave" aria-hidden />
              </button>
              <div className="h-px bg-borde" />
              <button
                type="button"
                onClick={() => setConfirmandoLogoutAll(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-elevada"
              >
                <Users className="size-4 text-suave" aria-hidden />
                <span className="flex-1 text-tinta">{t('ajustes.cerrar_todas')}</span>
                <ChevronRight className="size-4 text-suave" aria-hidden />
              </button>
            </div>
          </section>

          {/* ── SESIÓN ────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-tenue">
              {t('ajustes.seccion_sesion')}
            </h3>
            <button
              type="button"
              onClick={() => {
                cerrarSesion()
                mostrar(t('aviso.sesion_cerrada'))
              }}
              className="flex w-full items-center justify-center gap-2 rounded-tarjeta border border-rojo/30 bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo transition-colors hover:bg-rojo/20"
            >
              <LogOut className="size-4" aria-hidden />
              {t('ajustes.cerrar_sesion')}
            </button>
          </section>

          {/* ── ZONA PELIGROSA ────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-rojo">
              {t('ajustes.zona_peligrosa')}
            </h3>
            <p className="text-[13px] text-tenue">{t('ajustes.zona_peligrosa_ayuda')}</p>
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              className="flex w-full items-center justify-center gap-2 rounded-tarjeta border border-rojo/40 bg-rojo/15 px-4 py-3 text-sm font-medium text-rojo transition-colors hover:bg-rojo/25"
            >
              <Trash2 className="size-4" aria-hidden />
              {t('ajustes.eliminar_cuenta')}
            </button>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde pt-4">
            <Boton
              type="button"
              variante="fantasma"
              onClick={onCerrar}
              disabled={guardandoNombre}
            >
              {t('comun.cancelar')}
            </Boton>
            <Boton type="submit" form="perfil-form" disabled={!nombreCambio || guardandoNombre}>
              {guardandoNombre ? t('comun.guardando') : t('comun.guardar')}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* ── Modales anidados ─────────────────────────────── */}

      {editorFotoAbierto && (
        <EditorFotoPerfil
          archivo={null}
          nombre={usuario.displayName || usuario.email || '?'}
          onCerrar={() => setEditorFotoAbierto(false)}
          onGuardado={async (dataUrl) => {
            setEditorFotoAbierto(false)
            const res = await api.patch<{ user: { fotoUrl: string | null } }>(
              '/auth/perfil',
              { fotoUrl: dataUrl },
            )
            if (res.ok) {
              await refrescar()
              mostrar(t('aviso.foto_actualizada'))
            } else {
              mostrar(res.error ?? t('aviso.no_foto'), 'error')
            }
          }}
        />
      )}

      {quitandoFoto && (
        <Modal
          abierto
          onCerrar={() => setQuitandoFoto(false)}
          titulo={t('ajustes.quitar_foto_pregunta')}
          ancho="sm:max-w-sm"
        >
          <p className="text-sm text-suave">{t('ajustes.foto_actual')}</p>
          <div className="mt-5 flex gap-3">
            <Boton type="button" variante="fantasma" onClick={() => setQuitandoFoto(false)} className="flex-1">
              {t('comun.cancelar')}
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              onClick={async () => {
                setQuitandoFoto(false)
                const res = await api.patch<{ user: { fotoUrl: string | null } }>(
                  '/auth/perfil',
                  { fotoUrl: '' },
                )
                if (res.ok) {
                  await refrescar()
                  mostrar(t('aviso.foto_quitada'))
                } else {
                  mostrar(res.error ?? t('aviso.no_foto'), 'error')
                }
              }}
              className="flex-1"
            >
              {t('ajustes.confirmar_quitar_foto')}
            </Boton>
          </div>
        </Modal>
      )}

      {cambiandoPassword && (
        <CambiarPassword
          onCerrar={() => setCambiandoPassword(false)}
          onGuardado={() => {
            setCambiandoPassword(false)
            mostrar(t('aviso.password_actualizada'))
          }}
        />
      )}

      {cambiandoCorreo && (
        <CambiarCorreo
          correoActual={usuario.email}
          onCerrar={() => setCambiandoCorreo(false)}
          onEnviado={() => {
            setCambiandoCorreo(false)
            mostrar(t('aviso.enlace_correo'))
          }}
        />
      )}

      {confirmandoLogoutAll && (
        <Modal
          abierto
          onCerrar={() => setConfirmandoLogoutAll(false)}
          titulo={t('ajustes.logout_all_titulo')}
          ancho="sm:max-w-sm"
        >
          <p className="text-sm text-suave">{t('ajustes.logout_all_mensaje')}</p>
          <div className="mt-5 flex gap-3">
            <Boton type="button" variante="fantasma" onClick={() => setConfirmandoLogoutAll(false)} className="flex-1">
              {t('comun.cancelar')}
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              onClick={async () => {
                setConfirmandoLogoutAll(false)
                const res = await api.post<{ mensaje: string }>('/auth/logout-all')
                if (res.ok) {
                  cerrarSesion()
                  mostrar(t('aviso.sesiones_cerradas'))
                } else {
                  mostrar(res.error ?? t('aviso.no_cerrar_sesiones'), 'error')
                }
              }}
              className="flex-1"
            >
              {t('ajustes.logout_all_confirmar')}
            </Boton>
          </div>
        </Modal>
      )}

      {confirmandoEliminar && (
        <EliminarCuenta
          onCerrar={() => setConfirmandoEliminar(false)}
          onEliminado={() => {
            setConfirmandoEliminar(false)
            mostrar(t('aviso.cuenta_eliminada'))
            // cerrarSesion lo hace el propio EliminarCuenta
          }}
        />
      )}
    </>
  )
}
