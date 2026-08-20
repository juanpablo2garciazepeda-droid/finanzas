import { useEffect, useState } from 'react'
import { Trash2, KeyRound, Shield, User as UserIcon, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/estado/auth'
import { useT } from '@/estado/i18n'
import { useAvisos } from '@/estado/avisos'
import {
  adminApi,
  type AdminDetalleUsuario,
  type AdminUsuario,
} from '@/api/admin'
import { Boton, Tarjeta, TituloSeccion, clases } from '@/componentes/ui/Basicos'
import { Avatar } from '@/componentes/Avatar'
import { Modal, ConfirmarBorrado } from '@/componentes/ui/Modal'

/**
 * Panel de administración (solo `rol: 'admin'`).
 *
 * Lista todos los usuarios, permite ver el detalle con conteos, forzar
 * reset de contraseña y borrar usuarios. Cada acción destructiva pide
 * confirmación. Los conteos son solo de metadata — el admin NO entra a los
 * datos privados de los usuarios.
 */
export function Admin() {
  const { usuario } = useAuth()
  const t = useT()
  const navegar = useNavigate()
  const { mostrar } = useAvisos()
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [detalleAbierto, setDetalleAbierto] = useState<AdminDetalleUsuario | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<AdminUsuario | null>(null)

  // Si no es admin, lo mandamos al tablero. (La ruta también se valida en
  // backend: el guard devuelve 403.)
  useEffect(() => {
    if (usuario && usuario.rol !== 'admin') navegar('/')
  }, [usuario, navegar])

  const cargar = async () => {
    setCargando(true)
    const r = await adminApi.listar()
    if (r.ok && r.data) setUsuarios(r.data)
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
  }, [])

  const verDetalle = async (id: string) => {
    const r = await adminApi.detalle(id)
    if (r.ok && r.data) setDetalleAbierto(r.data)
    else mostrar(r.error ?? t('admin.error_detalle'), 'error')
  }

  const onEliminar = async (u: AdminUsuario) => {
    const r = await adminApi.eliminar(u.id)
    if (r.ok) {
      mostrar(t('admin.usuario_eliminado', { email: u.email }))
      setConfirmandoEliminar(null)
      void cargar()
    } else {
      mostrar(r.error ?? t('admin.error_eliminar'), 'error')
    }
  }

  const onForzarReset = async (u: AdminUsuario) => {
    const r = await adminApi.forzarReset(u.id)
    if (r.ok) mostrar(r.data?.mensaje ?? t('admin.reset_enviado'))
    else mostrar(r.error ?? t('admin.error_reset'), 'error')
  }

  const onCambiarRol = async (u: AdminUsuario, rol: 'usuario' | 'admin') => {
    if (u.id === usuario?.id) {
      mostrar(t('admin.no_cambiar_rol_propio'), 'error')
      return
    }
    const r = await adminApi.cambiarRol(u.id, rol)
    if (r.ok) {
      mostrar(t('admin.rol_cambiado', { email: u.email, rol: t(`comun.${rol}`) }))
      void cargar()
    } else {
      mostrar(r.error ?? t('admin.error_rol'), 'error')
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <TituloSeccion>{t('admin.titulo')}</TituloSeccion>
        <p className="px-1 text-[13px] text-tenue">{t('admin.ayuda')}</p>
      </section>

      {cargando ? (
        <Tarjeta>
          <p className="text-sm text-suave">{t('admin.cargando')}</p>
        </Tarjeta>
      ) : usuarios.length === 0 ? (
        <Tarjeta>
          <p className="text-sm text-suave">{t('admin.sin_usuarios')}</p>
        </Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-borde p-0">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar
                nombre={u.displayName || u.email}
                foto={u.fotoUrl}
                tamano="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-tinta">
                    {u.displayName || u.email}
                  </p>
                  {u.rol === 'admin' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-acento/10 px-1.5 py-0.5 text-[11px] font-medium text-acento">
                      <Shield className="size-2.5" aria-hidden />
                      {t('comun.admin')}
                    </span>
                  )}
                  {u.id === usuario?.id && (
                    <span className="rounded-full bg-elevada px-1.5 py-0.5 text-[11px] text-tenue">
                      {t('admin.tu')}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-tenue">{u.email}</p>
                <p className="mt-0.5 text-[11px] text-suave">
                  {t('admin.creado_en')} {new Date(u.creadoEn).toLocaleDateString()}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Boton
                  variante="secundario"
                  onClick={() => onForzarReset(u)}
                  className="px-2.5 py-1.5 text-[12px]"
                  aria-label={t('admin.forzar_reset')}
                  title={t('admin.forzar_reset')}
                  disabled={u.id === usuario?.id}
                >
                  <KeyRound className="size-3.5" aria-hidden />
                </Boton>
                <button
                  type="button"
                  onClick={() => setConfirmandoEliminar(u)}
                  disabled={u.id === usuario?.id}
                  className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={t('admin.eliminar')}
                  title={t('admin.eliminar')}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void verDetalle(u.id)}
                  className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
                  aria-label={t('admin.ver_detalle')}
                  title={t('admin.ver_detalle')}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </Tarjeta>
      )}

      {/* Modal de detalle */}
      <Modal
        abierto={!!detalleAbierto}
        onCerrar={() => setDetalleAbierto(null)}
        titulo={t('admin.detalle_titulo')}
        ancho="sm:max-w-md"
      >
        {detalleAbierto && (
          <DetalleAdmin
            data={detalleAbierto}
            miId={usuario?.id}
            alCerrar={() => setDetalleAbierto(null)}
            alCambiarRol={(rol) => {
              void onCambiarRol(
                {
                  id: detalleAbierto.usuario.id,
                  email: detalleAbierto.usuario.email,
                  displayName: detalleAbierto.usuario.displayName,
                  fotoUrl: detalleAbierto.usuario.fotoUrl,
                  emailVerificado: detalleAbierto.usuario.emailVerificado,
                  rol: detalleAbierto.usuario.rol,
                  idioma: detalleAbierto.usuario.idioma,
                  creadoEn: detalleAbierto.usuario.creadoEn,
                  updatedAt: detalleAbierto.usuario.updatedAt,
                },
                rol,
              )
            }}
          />
        )}
      </Modal>

      <ConfirmarBorrado
        abierto={!!confirmandoEliminar}
        onCerrar={() => setConfirmandoEliminar(null)}
        onConfirmar={() => confirmandoEliminar && void onEliminar(confirmandoEliminar)}
        titulo={t('admin.eliminar_titulo')}
        mensaje={t('admin.eliminar_mensaje', { email: confirmandoEliminar?.email ?? '' })}
        textoBoton={t('admin.eliminar_boton')}
      />
    </div>
  )
}

function DetalleAdmin({
  data,
  miId,
  alCerrar,
  alCambiarRol,
}: {
  data: AdminDetalleUsuario
  miId?: string
  alCerrar: () => void
  alCambiarRol: (rol: 'usuario' | 'admin') => void
}) {
  const t = useT()
  const u = data.usuario
  const esMiUsuario = u.id === miId
  const totalDatos =
    data.conteos.transacciones +
    data.conteos.categorias +
    data.conteos.deudas +
    data.conteos.metas

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar nombre={u.displayName || u.email} foto={u.fotoUrl} tamano="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-tinta">
            {u.displayName || u.email}
          </p>
          <p className="truncate text-sm text-suave">{u.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <Campo etiqueta={t('admin.rol')}>
          <span
            className={clases(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              u.rol === 'admin' ? 'bg-acento/10 text-acento' : 'bg-elevada text-suave',
            )}
          >
            {u.rol === 'admin' && <Shield className="size-3" aria-hidden />}
            {t(`comun.${u.rol}`)}
          </span>
        </Campo>
        <Campo etiqueta={t('admin.idioma')}>{u.idioma.toUpperCase()}</Campo>
        <Campo etiqueta={t('admin.email_verificado')}>
          {u.emailVerificado ? t('comun.si') : t('comun.no')}
        </Campo>
        <Campo etiqueta={t('admin.debe_cambiar_password')}>
          {u.debeCambiarPassword ? t('comun.si') : t('comun.no')}
        </Campo>
        <Campo etiqueta={t('admin.creado_en')}>
          {new Date(u.creadoEn).toLocaleDateString()}
        </Campo>
        <Campo etiqueta={t('admin.ultimo_cambio_password')}>
          {u.passwordActualizadoEn
            ? new Date(u.passwordActualizadoEn).toLocaleDateString()
            : '—'}
        </Campo>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-suave">
          {t('admin.datos_del_usuario')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DatoChip
            icono={KeyRound}
            etiqueta={t('admin.transacciones')}
            valor={data.conteos.transacciones}
          />
          <DatoChip
            icono={UserIcon}
            etiqueta={t('admin.categorias')}
            valor={data.conteos.categorias}
          />
          <DatoChip
            icono={Shield}
            etiqueta={t('admin.deudas')}
            valor={data.conteos.deudas}
          />
          <DatoChip
            icono={KeyRound}
            etiqueta={t('admin.metas')}
            valor={data.conteos.metas}
          />
        </div>
        <p className="mt-2 text-[11px] text-tenue">
          {t('admin.total_datos', { n: totalDatos })}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde pt-3">
        {u.rol === 'admin' ? (
          <Boton
            variante="secundario"
            onClick={() => alCambiarRol('usuario')}
            className="text-[13px]"
            disabled={esMiUsuario}
            title={esMiUsuario ? t('admin.no_cambiar_rol_propio') : undefined}
          >
            {t('admin.quitar_admin')}
          </Boton>
        ) : (
          <Boton
            variante="primario"
            onClick={() => alCambiarRol('admin')}
            className="text-[13px]"
            disabled={esMiUsuario}
            title={esMiUsuario ? t('admin.no_cambiar_rol_propio') : undefined}
          >
            {t('admin.hacer_admin')}
          </Boton>
        )}
        <Boton variante="secundario" onClick={alCerrar} className="text-[13px]">
          {t('comun.cerrar')}
        </Boton>
      </div>
    </div>
  )
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-tenue">{etiqueta}</p>
      <div className="mt-0.5 text-tinta">{children}</div>
    </div>
  )
}

function DatoChip({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: React.ComponentType<{ className?: string }>
  etiqueta: string
  valor: number
}) {
  return (
    <div className="rounded-tarjeta border border-borde bg-superficie p-3 text-center">
      <Icono className="mx-auto size-4 text-suave" aria-hidden />
      <p className="mt-1 text-lg font-semibold text-tinta cifras">{valor}</p>
      <p className="text-[11px] text-tenue">{etiqueta}</p>
    </div>
  )
}
