import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Folder,
  KeyRound,
  Mail,
  Receipt,
  Repeat,
  Shield,
  Target,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
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
 * reset de contraseña y borrar usuarios — uno por uno o en lote. Cada
 * acción destructiva pide confirmación. Los conteos son solo de metadata:
 * el admin NO entra a los datos privados de los usuarios.
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
  const [confirmandoLote, setConfirmandoLote] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [eliminandoLote, setEliminandoLote] = useState(false)

  // Si no es admin, lo mandamos al tablero. (La ruta también se valida en
  // backend: el guard devuelve 403.)
  useEffect(() => {
    if (usuario && usuario.rol !== 'admin') navegar('/')
  }, [usuario, navegar])

  const cargar = async () => {
    setCargando(true)
    const r = await adminApi.listar()
    if (r.ok && r.data) {
      setUsuarios(r.data)
      // Limpia la selección de ids que ya no existen (por si alguien fue
      // borrado en otra pestaña o por un proceso externo).
      setSeleccionados((prev) => {
        const ids = new Set(r.data!.map((u) => u.id))
        const siguiente = new Set<string>()
        for (const id of prev) if (ids.has(id)) siguiente.add(id)
        return siguiente
      })
    }
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
      // Quita el id de la selección si estaba.
      setSeleccionados((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(u.id)
        return siguiente
      })
      void cargar()
    } else {
      mostrar(r.error ?? t('admin.error_eliminar'), 'error')
    }
  }

  const onEliminarLote = async () => {
    const ids = Array.from(seleccionados)
    if (ids.length === 0) return
    setEliminandoLote(true)
    const r = await adminApi.eliminarLote(ids)
    setEliminandoLote(false)
    setConfirmandoLote(false)
    if (r.ok && r.data) {
      const { eliminados, omitidos } = r.data
      if (eliminados.length > 0) {
        mostrar(t('admin.lote_eliminados', { n: eliminados.length }))
      }
      if (omitidos.length > 0) {
        // Avisa por cada omitido: el admin necesita saber por qué un id que
        // seleccionó no se borró.
        for (const o of omitidos) {
          mostrar(t('admin.lote_omitido', { id: o.id, razon: o.razon }), 'error')
        }
      }
      // Limpia la selección: los eliminados ya no existen; los omitidos
      // tampoco conviene mantenerlos (si el admin vuelve a intentar, el
      // backend va a rechazarlos por la misma razón).
      setSeleccionados(new Set())
      void cargar()
    } else {
      mostrar(r.error ?? t('admin.error_eliminar_lote'), 'error')
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

  // Las filas elegibles para selección: nunca el admin actual.
  const idsElegibles = useMemo(
    () => usuarios.filter((u) => u.id !== usuario?.id).map((u) => u.id),
    [usuarios, usuario?.id],
  )
  const todosSeleccionados =
    idsElegibles.length > 0 && idsElegibles.every((id) => seleccionados.has(id))
  const alternarTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(idsElegibles))
    }
  }
  const alternar = (id: string) => {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
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
          {/* Header de selección múltiple. Siempre visible para que el admin
              sepa que puede elegir varios desde el inicio. */}
          {idsElegibles.length > 0 && (
            <div className="flex items-center gap-3 border-b border-borde bg-elevada/40 px-4 py-2">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={alternarTodos}
                aria-label={t('admin.seleccionar_todo')}
                className="size-4 shrink-0 cursor-pointer accent-acento"
              />
              <span className="text-[13px] text-suave">
                {seleccionados.size > 0
                  ? t('admin.n_seleccionados', { n: seleccionados.size })
                  : t('admin.seleccionar_varios')}
              </span>
            </div>
          )}

          {usuarios.map((u) => {
            const esMiUsuario = u.id === usuario?.id
            const estaSeleccionado = !esMiUsuario && seleccionados.has(u.id)
            return (
              <div
                key={u.id}
                className={clases(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  estaSeleccionado && 'bg-acento/5',
                )}
              >
                {/* El checkbox se oculta para el propio admin: nunca se
                    puede seleccionar a sí mismo. */}
                {esMiUsuario ? (
                  <span className="size-4 shrink-0" aria-hidden />
                ) : (
                  <input
                    type="checkbox"
                    checked={estaSeleccionado}
                    onChange={() => alternar(u.id)}
                    aria-label={t('admin.seleccionar_usuario', { email: u.email })}
                    className="size-4 shrink-0 cursor-pointer accent-acento"
                  />
                )}
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
                    disabled={esMiUsuario}
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                  </Boton>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(u)}
                    disabled={esMiUsuario}
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
            )
          })}
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
            alForzarReset={() =>
              void onForzarReset({
                id: detalleAbierto.usuario.id,
                email: detalleAbierto.usuario.email,
                displayName: detalleAbierto.usuario.displayName,
                fotoUrl: detalleAbierto.usuario.fotoUrl,
                emailVerificado: detalleAbierto.usuario.emailVerificado,
                rol: detalleAbierto.usuario.rol,
                idioma: detalleAbierto.usuario.idioma,
                creadoEn: detalleAbierto.usuario.creadoEn,
                updatedAt: detalleAbierto.usuario.updatedAt,
              })
            }
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

      {/* Confirmación del borrado en lote: el admin revisa cuántos va a
          borrar antes de ejecutar, y la lista de emails para que no borre
          a quien no debe por error. */}
      <ConfirmarBorradoLote
        abierto={confirmandoLote}
        cargando={eliminandoLote}
        total={seleccionados.size}
        emails={usuarios.filter((u) => seleccionados.has(u.id)).map((u) => u.email)}
        onCerrar={() => setConfirmandoLote(false)}
        onConfirmar={() => void onEliminarLote()}
      />

      {/* Barra flotante de selección: aparece cuando hay al menos un
          usuario seleccionado. Persistente mientras la selección esté
          abierta, para que el admin no tenga que ir a buscarla. */}
      {seleccionados.size > 0 && (
        <div
          role="region"
          aria-label={t('admin.seleccion_activa')}
          className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-borde bg-superficie/95 px-4 py-2 shadow-flotante backdrop-blur lg:bottom-8"
        >
          <span className="text-[13px] font-medium text-tinta">
            {t('admin.n_seleccionados', { n: seleccionados.size })}
          </span>
          <button
            type="button"
            onClick={() => setSeleccionados(new Set())}
            className="rounded-full p-1 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
            aria-label={t('admin.limpiar_seleccion')}
          >
            <X className="size-3.5" aria-hidden />
          </button>
          <Boton
            variante="peligro"
            onClick={() => setConfirmandoLote(true)}
            className="text-[13px]"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t('admin.eliminar_n', { n: seleccionados.size })}
          </Boton>
        </div>
      )}
    </div>
  )
}

/**
 * Modal de confirmación específico para borrado en lote. Muestra el conteo
 * y los emails que se van a borrar: el admin no debería ver un "estás
 * borrando 12 usuarios" sin saber cuáles.
 */
function ConfirmarBorradoLote({
  abierto,
  cargando,
  total,
  emails,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean
  cargando: boolean
  total: number
  emails: string[]
  onCerrar: () => void
  onConfirmar: () => void
}) {
  const t = useT()
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={t('admin.eliminar_lote_titulo', { n: total })}
      ancho="sm:max-w-md"
    >
      <p className="text-sm text-suave">{t('admin.eliminar_lote_aviso')}</p>
      <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-campo bg-elevada p-3 text-[13px] text-tinta">
        {emails.map((email) => (
          <li key={email} className="truncate">
            {email}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCerrar}
          disabled={cargando}
          className="flex-1 rounded-xl border border-borde bg-elevada px-4 py-2.5 text-sm font-medium text-tinta transition-colors hover:border-borde-fuerte disabled:opacity-50"
        >
          {t('comun.cancelar')}
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={cargando || total === 0}
          className="flex-1 rounded-xl border border-rojo/30 bg-rojo/15 px-4 py-2.5 text-sm font-medium text-rojo transition-colors hover:bg-rojo/25 disabled:opacity-50"
        >
          {cargando ? t('comun.eliminando') : t('admin.eliminar_n', { n: total })}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Detalle de un usuario, en tres bloques con jerarquía en vez de una rejilla
 * de seis campos sueltos: quién es, cómo está su acceso, y qué tiene cargado.
 *
 * El bloque de contraseña dice lo que hay que decir: se guarda como hash y
 * NO se puede leer. Es la pregunta que todo admin hace, y contestarla con un
 * campo vacío o con el hash crudo no ayuda a nadie. Lo accionable —mandarle
 * un enlace para que ponga una nueva— vive justo debajo del aviso.
 */
function DetalleAdmin({
  data,
  miId,
  alCerrar,
  alCambiarRol,
  alForzarReset,
}: {
  data: AdminDetalleUsuario
  miId?: string
  alCerrar: () => void
  alCambiarRol: (rol: 'usuario' | 'admin') => void
  alForzarReset: () => void
}) {
  const t = useT()
  const u = data.usuario
  const esMiUsuario = u.id === miId
  const c = data.conteos
  const totalDatos =
    c.transacciones + c.categorias + c.presupuestos + c.deudas + c.metas + c.recurrentes

  const fecha = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  return (
    <div className="space-y-5">
      {/* ── Identidad ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Avatar nombre={u.displayName || u.email} foto={u.fotoUrl} tamano="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-tinta">
            {u.displayName || u.email}
          </p>
          <p className="truncate text-sm text-suave">{u.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={clases(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                u.rol === 'admin' ? 'bg-acento/10 text-acento' : 'bg-elevada text-suave',
              )}
            >
              {u.rol === 'admin' && <Shield className="size-3" aria-hidden />}
              {t(`comun.${u.rol}`)}
            </span>
            <span
              className={clases(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                u.emailVerificado ? 'bg-verde/10 text-verde' : 'bg-ambar/10 text-ambar',
              )}
            >
              <BadgeCheck className="size-3" aria-hidden />
              {t(u.emailVerificado ? 'admin.verificado' : 'admin.sin_verificar')}
            </span>
            {esMiUsuario && (
              <span className="rounded-full bg-elevada px-2 py-0.5 text-[11px] text-tenue">
                {t('admin.tu')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cuenta ────────────────────────────────────────────────────── */}
      <Bloque titulo={t('admin.cuenta')}>
        <Renglon icono={CalendarDays} etiqueta={t('admin.miembro_desde')} valor={fecha(u.creadoEn)} />
        <Renglon icono={Mail} etiqueta={t('admin.idioma')} valor={u.idioma.toUpperCase()} />
        <Renglon
          icono={Repeat}
          etiqueta={t('admin.resumen_semanal')}
          valor={t(u.recibirDigest ? 'comun.activo' : 'comun.inactivo')}
        />
      </Bloque>

      {/* ── Seguridad ─────────────────────────────────────────────────── */}
      <Bloque titulo={t('admin.seguridad')}>
        <div className="px-3 py-3">
          <div className="flex items-start gap-2.5">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-tenue" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-tinta">{t('admin.contrasena')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-tenue">
                {t('admin.contrasena_no_visible')}
              </p>
              <p className="mt-1.5 text-[12px] text-suave">
                {u.passwordActualizadoEn
                  ? t('admin.cambiada_el', { fecha: fecha(u.passwordActualizadoEn) })
                  : t('admin.sin_cambio_password')}
                {' · '}
                <span className={u.debeCambiarPassword ? 'text-ambar' : 'text-tenue'}>
                  {t(u.debeCambiarPassword ? 'admin.pendiente_cambio' : 'admin.password_al_dia')}
                </span>
              </p>
              <Boton
                variante="secundario"
                onClick={alForzarReset}
                disabled={esMiUsuario}
                className="mt-2.5 text-[12px]"
              >
                <KeyRound className="size-3.5" aria-hidden />
                {t('admin.enviar_reset')}
              </Boton>
            </div>
          </div>
        </div>
      </Bloque>

      {/* ── Qué tiene cargado ─────────────────────────────────────────── */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-tenue">
          {t('admin.datos_del_usuario')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <DatoChip icono={Receipt} etiqueta={t('admin.transacciones')} valor={c.transacciones} />
          <DatoChip icono={Folder} etiqueta={t('admin.categorias')} valor={c.categorias} />
          <DatoChip icono={Wallet} etiqueta={t('admin.presupuestos')} valor={c.presupuestos} />
          <DatoChip icono={CreditCard} etiqueta={t('admin.deudas')} valor={c.deudas} />
          <DatoChip icono={Target} etiqueta={t('admin.metas')} valor={c.metas} />
          <DatoChip icono={Repeat} etiqueta={t('admin.recurrentes')} valor={c.recurrentes} />
        </div>
        <p className="mt-2 px-1 text-[11px] text-tenue">
          {t('admin.total_datos', { n: totalDatos })}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde pt-4">
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
            variante="secundario"
            onClick={() => alCambiarRol('admin')}
            className="text-[13px]"
            disabled={esMiUsuario}
            title={esMiUsuario ? t('admin.no_cambiar_rol_propio') : undefined}
          >
            <Shield className="size-3.5" aria-hidden />
            {t('admin.hacer_admin')}
          </Boton>
        )}
        <Boton variante="primario" onClick={alCerrar} className="text-[13px]">
          {t('comun.cerrar')}
        </Boton>
      </div>
    </div>
  )
}

/** Grupo con título pequeño y tarjeta de renglones divididos. */
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-tenue">
        {titulo}
      </p>
      <div className="divide-y divide-borde rounded-tarjeta border border-borde">{children}</div>
    </div>
  )
}

/** Renglón etiqueta → valor. El valor a la derecha para que la columna alinee. */
function Renglon({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: React.ComponentType<{ className?: string }>
  etiqueta: string
  valor: string
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <Icono className="size-4 shrink-0 text-tenue" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] text-suave">{etiqueta}</span>
      <span className="shrink-0 text-[13px] font-medium text-tinta">{valor}</span>
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
    <div className="rounded-tarjeta border border-borde bg-superficie p-2.5 text-center">
      <Icono className="mx-auto size-4 text-suave" aria-hidden />
      <p className="cifras mt-1 text-lg font-semibold text-tinta">{valor}</p>
      <p className="text-[11px] leading-tight text-tenue">{etiqueta}</p>
    </div>
  )
}
