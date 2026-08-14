import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  LogOut,
  Pencil,
  Plus,
  Repeat,
  ShieldOff,
  Trash2,
  X,
} from 'lucide-react'
import type { Acento, Categoria, TipoMovimiento } from '@/dominio/tipos'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { nombrePeriodo } from '@/dominio/fechas'
import { NOMBRE_CICLO } from '@/dominio/ciclos'
import { PALETA } from '@/datos/categoriasIniciales'
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  exportarMisDatos,
  importarMovimientosCsv,
} from '@/datos/repositorio'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { hayNotificaciones, pedirPermiso } from '@/estado/recordatorios'
import { useI18n } from '@/estado/i18n'
import { MUESTRA_ACENTO, NOMBRE_TEMA, useEsOscuro } from '@/estado/tema'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import { Boton, Campo, Entrada, Selector, Tarjeta, TituloSeccion, clases } from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
import { Segmentado } from '@/componentes/ui/Segmentado'
import { SelectorColor, SelectorIcono } from '@/componentes/ui/Selectores'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'
import { descargarMovimientosCSV } from '@/exportar/csv'
import { descargarReporteAnual } from '@/exportar/pdf'

const MONEDAS = [
  { codigo: 'MXN', locale: 'es-MX', etiqueta: 'Peso mexicano (MXN)' },
  { codigo: 'USD', locale: 'es-MX', etiqueta: 'Dólar (USD)' },
  { codigo: 'EUR', locale: 'es-ES', etiqueta: 'Euro (EUR)' },
  { codigo: 'COP', locale: 'es-CO', etiqueta: 'Peso colombiano (COP)' },
  { codigo: 'ARS', locale: 'es-AR', etiqueta: 'Peso argentino (ARS)' },
  { codigo: 'CLP', locale: 'es-CL', etiqueta: 'Peso chileno (CLP)' },
  { codigo: 'PEN', locale: 'es-PE', etiqueta: 'Sol peruano (PEN)' },
]

export function Ajustes() {
  const {
    ajustes,
    categorias,
    transacciones,
    ctx,
    pagos,
    periodo,
    hayMovimientos,
    refrescar,
    guardarAjustes,
  } = useFinanzas()
  const { mostrar } = useAvisos()
  const { usuario, cerrarSesion, refrescar: refrescarAuth } = useAuth()
  const i18n = useI18n()
  const esOscuro = useEsOscuro()
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | 'nueva' | undefined>()
  const [borrandoCategoria, setBorrandoCategoria] = useState<Categoria | undefined>()
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [confirmandoLogoutAll, setConfirmandoLogoutAll] = useState(false)
  const [reenviandoVerificacion, setReenviandoVerificacion] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [importando, setImportando] = useState(false)

  return (
    <div className="space-y-6">
      <section>
        <TituloSeccion>Tu cuenta</TituloSeccion>
        <Tarjeta className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-tinta">{usuario?.email}</p>
              <p className="mt-0.5 truncate text-[13px] text-tenue">{usuario?.displayName || 'Sin nombre'}</p>
              {usuario && !usuario.emailVerificado && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-ambar/10 px-2 py-0.5 text-[12px] text-ambar">
                  <X className="size-3" aria-hidden />
                  Correo sin verificar
                </p>
              )}
              {usuario?.emailVerificado && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-verde/10 px-2 py-0.5 text-[12px] text-verde">
                  <ShieldOff className="size-3 -scale-x-100" aria-hidden />
                  Correo verificado
                </p>
              )}
            </div>
            <Boton variante="secundario" onClick={cerrarSesion}>
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </Boton>
          </div>

          {usuario && !usuario.emailVerificado && (
            <Boton
              variante="fantasma"
              disabled={reenviandoVerificacion}
              onClick={async () => {
                setReenviandoVerificacion(true)
                const res = await api.post('/auth/reenviar-verificacion', {
                  email: usuario.email,
                })
                setReenviandoVerificacion(false)
                mostrar(res.ok ? 'Te reenviamos el correo de verificación' : (res.error ?? 'No se pudo reenviar'))
              }}
              className="w-full sm:w-auto"
            >
              {reenviandoVerificacion ? 'Enviando…' : 'Reenviar correo de verificación'}
            </Boton>
          )}

          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => setEditandoNombre(true)}>
              <Pencil className="size-4" aria-hidden />
              Editar nombre
            </Boton>
            <Boton variante="secundario" onClick={() => setCambiandoCorreo(true)}>
              Cambiar correo
            </Boton>
            <Boton variante="secundario" onClick={() => setCambiandoPassword(true)}>
              Cambiar contraseña
            </Boton>
            <Boton variante="secundario" onClick={() => setConfirmandoLogoutAll(true)}>
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión en todos lados
            </Boton>
          </div>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Automatización</TituloSeccion>
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-tinta">Gastos e ingresos recurrentes</p>
              <p className="mt-0.5 text-[13px] text-tenue">
                Crea plantillas (Netflix, la renta, tu sueldo…) y se agregan solas cada mes.
              </p>
            </div>
            <Link
              to="/recurrentes"
              className="inline-flex items-center gap-2 rounded-full border border-borde bg-elevada px-4 py-2 text-[15px] text-acento transition-colors hover:bg-hundida"
            >
              <Repeat className="size-4" aria-hidden />
              Administrar
            </Link>
          </div>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Tus datos</TituloSeccion>
        <Tarjeta className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-tinta">Exportar todos mis datos</p>
              <p className="mt-0.5 text-[13px] text-tenue">
                Descarga una copia completa (categorías, movimientos, deudas, metas, recurrentes,
                ajustes) en formato JSON. Lo que la ley te garantiza tener.
              </p>
            </div>
            <Boton
              variante="secundario"
              disabled={exportando}
              onClick={async () => {
                setExportando(true)
                try {
                  const datos = await exportarMisDatos()
                  const blob = new Blob([JSON.stringify(datos, null, 2)], {
                    type: 'application/json',
                  })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `juanpa-finanzas-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  mostrar('Descarga iniciada')
                } catch (err) {
                  mostrar(err instanceof Error ? err.message : 'No se pudo exportar', 'error')
                } finally {
                  setExportando(false)
                }
              }}
            >
              <FileDown className="size-4" aria-hidden />
              {exportando ? 'Exportando…' : 'Exportar todo'}
            </Boton>
          </div>

          <div className="border-t border-borde pt-3">
            <label className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-tinta">Importar movimientos desde CSV</p>
                <p className="mt-0.5 text-[13px] text-tenue">
                  Columnas: <code className="rounded bg-elevada px-1">fecha, tipo, monto, categoria, metodoPago, nota</code>.
                  Las categorías nuevas se crean al vuelo.
                </p>
              </div>
              <span className="inline-flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  id="importar-csv"
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0]
                    if (!archivo) return
                    setImportando(true)
                    try {
                      const r = await importarMovimientosCsv(archivo)
                      mostrar(
                        `Listo: ${r.insertadas} movimientos. ${r.categoriasCreadas.length} categorías nuevas.`,
                      )
                      if (r.errores.length > 0) {
                        mostrar(`${r.errores.length} filas con error. Revisa la consola.`, 'error')
                        // eslint-disable-next-line no-console
                        console.warn('Errores de importación:', r.errores)
                      }
                      await refrescar()
                    } catch (err) {
                      mostrar(err instanceof Error ? err.message : 'No se pudo importar', 'error')
                    } finally {
                      setImportando(false)
                      e.target.value = ''
                    }
                  }}
                />
                <Boton
                  variante="secundario"
                  disabled={importando}
                  onClick={() => document.getElementById('importar-csv')?.click()}
                >
                  <FileUp className="size-4" aria-hidden />
                  {importando ? 'Importando…' : 'Elegir archivo'}
                </Boton>
              </span>
            </label>
          </div>
        </Tarjeta>
      </section>

      {editandoNombre && usuario && (
        <EditarNombre
          inicial={usuario.displayName}
          onCerrar={() => setEditandoNombre(false)}
          onGuardado={async () => {
            await refrescarAuth()
            mostrar('Nombre actualizado')
            setEditandoNombre(false)
          }}
        />
      )}

      {cambiandoPassword && (
        <CambiarPassword
          onCerrar={() => setCambiandoPassword(false)}
          onGuardado={() => {
            setCambiandoPassword(false)
            mostrar('Contraseña actualizada. En otros dispositivos se cerró la sesión.')
          }}
        />
      )}

      {cambiandoCorreo && (
        <CambiarCorreo
          correoActual={usuario?.email ?? ''}
          onCerrar={() => setCambiandoCorreo(false)}
          onEnviado={() => {
            setCambiandoCorreo(false)
            mostrar('Te enviamos un enlace al nuevo correo. Pícalo para confirmar.')
          }}
        />
      )}

      {confirmandoLogoutAll && (
        <ConfirmarAccion
          abierto
          titulo="¿Cerrar sesión en todos tus dispositivos?"
          mensaje="Cerraremos tu cuenta en todos los navegadores y teléfonos donde la tengas abierta. Aquí también te vamos a pedir volver a iniciar sesión."
          textoConfirmar="Sí, cerrar todas"
          textoCancelar="Cancelar"
          onCerrar={() => setConfirmandoLogoutAll(false)}
          onConfirmar={async () => {
            const res = await api.post<{ mensaje: string }>('/auth/logout-all')
            setConfirmandoLogoutAll(false)
            if (res.ok) {
              cerrarSesion()
              mostrar('Listo, cerramos todas las sesiones')
            } else {
              mostrar(res.error ?? 'No se pudo cerrar todas las sesiones', 'error')
            }
          }}
        />
      )}

      {confirmandoEliminar && (
        <EliminarCuenta
          onCerrar={() => setConfirmandoEliminar(false)}
          onEliminado={() => {
            cerrarSesion()
            mostrar('Tu cuenta y tus datos fueron eliminados')
          }}
        />
      )}

      <section>
        <TituloSeccion>Zona peligrosa</TituloSeccion>
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-tinta">Eliminar mi cuenta</p>
              <p className="mt-0.5 text-[13px] text-tenue">
                Borramos tu cuenta y todos los movimientos, deudas, metas y categorías asociados. No se puede deshacer.
              </p>
            </div>
            <Boton variante="peligro" onClick={() => setConfirmandoEliminar(true)}>
              <Trash2 className="size-4" aria-hidden />
              Eliminar cuenta
            </Boton>
          </div>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Moneda y formato</TituloSeccion>
        <Tarjeta className="space-y-4">
          <Campo etiqueta="Moneda" htmlFor="moneda">
            <Selector
              id="moneda"
              value={ajustes.moneda}
              onChange={(e) => {
                const elegida = MONEDAS.find((m) => m.codigo === e.target.value)
                if (elegida) void guardarAjustes({ moneda: elegida.codigo, locale: elegida.locale })
              }}
            >
              {MONEDAS.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.etiqueta}
                </option>
              ))}
            </Selector>
          </Campo>
          <p className="text-xs text-tenue">
            Los montos ya registrados no se convierten: cambiar la moneda solo cambia cómo se muestran.
            Ejemplo: {formatearMoneda(123456, ajustes.moneda, ajustes.locale)}.
          </p>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Apariencia</TituloSeccion>
        <Tarjeta className="space-y-5">
          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">Idioma</span>
            <Segmentado
              etiqueta="Idioma"
              valor={i18n.idioma}
              onCambiar={(v) => void i18n.setIdioma(v as 'es' | 'en')}
              opciones={[
                { valor: 'es', etiqueta: 'Español' },
                { valor: 'en', etiqueta: 'English' },
              ]}
            />
            <p className="mt-1.5 text-[13px] text-tenue">
              Algunas cadenas aún no están traducidas; seguimos en ello.
            </p>
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">Tema</span>
            <Segmentado
              etiqueta="Tema"
              valor={ajustes.tema}
              onCambiar={(tema) => void guardarAjustes({ tema })}
              opciones={(['claro', 'oscuro', 'sistema'] as const).map((valor) => ({
                valor,
                etiqueta: NOMBRE_TEMA[valor],
              }))}
            />
            <p className="mt-1.5 text-[13px] text-tenue">
              Automático sigue lo que tenga configurado tu teléfono o tu Mac.
            </p>
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">Color de acento</span>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de acento">
              {(Object.keys(MUESTRA_ACENTO) as Acento[]).map((opcion) => {
                const muestra = MUESTRA_ACENTO[opcion]
                const activo = ajustes.acento === opcion
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={muestra.nombre}
                    title={muestra.nombre}
                    onClick={() => void guardarAjustes({ acento: opcion })}
                    className={clases(
                      'size-9 rounded-full transition-transform',
                      activo
                        ? 'ring-2 ring-tinta ring-offset-2 ring-offset-superficie'
                        : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: esOscuro ? muestra.oscuro : muestra.claro }}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-[13px] text-tenue">
              Cada color tiene su versión clara y oscura: la que contrasta sobre blanco se apaga
              sobre negro, así que no es el mismo tono en ambos temas.
            </p>
          </div>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Tu dinero</TituloSeccion>
        <Tarjeta className="space-y-3">
          <CampoSaldo
            valor={ajustes.saldoInicial}
            fecha={ajustes.saldoInicialFecha}
          />
          <p className="text-[13px] text-tenue">
            Es una foto, no un dato que la app pueda adivinar. A partir de ella suma tus ingresos y
            resta gastos, abonos a deudas y lo que apartas a metas, y así sabe cuánto te queda hoy.
            Si te desfasas, vuelve aquí y pon el saldo real de nuevo.
          </p>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Tu ingreso</TituloSeccion>
        <Tarjeta className="space-y-3">
          <CampoIngreso valor={ajustes.ingresoMensual} moneda={ajustes.moneda} locale={ajustes.locale} />
          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">Cada cuánto cobras</span>
            <Segmentado
              etiqueta="Cada cuánto cobras"
              valor={ajustes.cicloPago}
              onCambiar={(cicloPago) => void guardarAjustes({ cicloPago })}
              opciones={(['semanal', 'quincenal', 'mensual'] as const).map((valor) => ({
                valor,
                etiqueta: NOMBRE_CICLO[valor],
              }))}
            />
            <p className="mt-1.5 text-[13px] text-tenue">
              El tablero y el semáforo miden sobre esta ventana. Si cobras por quincena, "cuánto
              puedo gastar" se calcula hasta tu próximo corte, no hasta fin de mes.
            </p>
          </div>

          <p className="text-[13px] text-tenue">
            El ingreso se toma primero de lo que de verdad entró en el ciclo; si aún no hay nada
            registrado, se usa la parte de este sueldo que le toca; y si tampoco lo pones, tu
            promedio de los últimos meses.
          </p>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Cómo te avisa el semáforo</TituloSeccion>
        <Tarjeta className="space-y-5">
          <div>
            <Campo
              etiqueta="Ventana de vencimientos"
              ayuda="Un pago dentro de este plazo se aparta del margen antes de darte luz verde."
              htmlFor="dias"
            >
              <div className="flex items-center gap-3">
                <input
                  id="dias"
                  type="range"
                  min={1}
                  max={30}
                  value={ajustes.diasAvisoVencimiento}
                  onChange={(e) => void guardarAjustes({ diasAvisoVencimiento: Number(e.target.value) })}
                  className="flex-1 accent-acento"
                />
                <span className="cifras w-16 text-right text-sm text-tinta">
                  {ajustes.diasAvisoVencimiento} días
                </span>
              </div>
            </Campo>
          </div>

          <div>
            <Campo
              etiqueta="Umbral de precaución"
              ayuda="A partir de este porcentaje del límite, el semáforo pasa a ámbar."
              htmlFor="umbral"
            >
              <div className="flex items-center gap-3">
                <input
                  id="umbral"
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={Math.round(ajustes.umbralPrecaucion * 100)}
                  onChange={(e) => void guardarAjustes({ umbralPrecaucion: Number(e.target.value) / 100 })}
                  className="flex-1 accent-acento"
                />
                <span className="cifras w-16 text-right text-sm text-tinta">
                  {Math.round(ajustes.umbralPrecaucion * 100)}%
                </span>
              </div>
            </Campo>
          </div>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Recordatorios de pago</TituloSeccion>
        <Tarjeta className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={ajustes.notificacionesActivas}
              onChange={async (e) => {
                if (!e.target.checked) {
                  await guardarAjustes({ notificacionesActivas: false })
                  return
                }
                const permitido = await pedirPermiso()
                if (permitido) {
                  await guardarAjustes({ notificacionesActivas: true, ultimaRevisionVencimientos: '' })
                  mostrar('Te avisaré de los pagos próximos')
                } else {
                  mostrar('El navegador bloqueó las notificaciones', 'error')
                }
              }}
              disabled={!hayNotificaciones()}
              className="mt-0.5 size-4 accent-acento"
            />
            <span>
              <span className="block text-sm text-tinta">Avisarme de pagos próximos (en el navegador)</span>
              <span className="mt-1 block text-xs text-tenue">
                {hayNotificaciones()
                  ? 'El aviso llega la primera vez que abres la app cada día, no a una hora fija.'
                  : 'Este navegador no soporta notificaciones.'}
              </span>
            </span>
          </label>

          {usuario && (
            <label className="flex items-start gap-3 border-t border-borde pt-3">
              <input
                type="checkbox"
                checked={usuario.recibirDigest}
                onChange={async (e) => {
                  const r = await api.patch<{ user: { recibirDigest: boolean } }>('/auth/perfil', {
                    recibirDigest: e.target.checked,
                  })
                  if (r.ok) {
                    await refrescarAuth()
                    mostrar(e.target.checked ? 'Te enviaremos el resumen' : 'No te enviaremos el resumen')
                  }
                }}
                className="mt-0.5 size-4 accent-acento"
              />
              <span>
                <span className="block text-sm text-tinta">Resumen semanal por correo</span>
                <span className="mt-1 block text-xs text-tenue">
                  Cada lunes con tus ingresos, gastos y deuda de la semana anterior.
                </span>
              </span>
            </label>
          )}
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion
          accion={
            <Boton
              variante="secundario"
              onClick={() => setEditandoCategoria('nueva')}
              className="px-4 py-2 text-[15px]"
            >
              <Plus className="size-4" aria-hidden />
              Nueva categoría
            </Boton>
          }
        >
          Categorías
        </TituloSeccion>
        <Tarjeta className="divide-y divide-borde p-0">
          {categorias.map((categoria) => (
            <div key={categoria.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${categoria.color}1f` }}
              >
                <Icono
                  nombre={categoria.icono}
                  className="size-4"
                  style={{ color: categoria.color }}
                  strokeWidth={1.75}
                />
              </span>
              <span
                className={clases(
                  'min-w-0 flex-1 truncate text-sm',
                  categoria.archivada ? 'text-tenue line-through' : 'text-tinta',
                )}
              >
                {categoria.nombre}
              </span>
              <span className="shrink-0 text-xs text-tenue">
                {categoria.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
              </span>
              <button
                type="button"
                onClick={() => setEditandoCategoria(categoria)}
                aria-label={`Editar ${categoria.nombre}`}
                className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setBorrandoCategoria(categoria)}
                aria-label={`Eliminar ${categoria.nombre}`}
                className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Exportar</TituloSeccion>
        <Tarjeta className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              disabled={!hayMovimientos || generandoPDF}
              onClick={async () => {
                setGenerandoPDF(true)
                try {
                  // jsPDF pesa más que el resto de la app junta: se carga solo
                  // cuando alguien pide de verdad un reporte.
                  const { descargarReporteMensual } = await import('@/exportar/pdf')
                  descargarReporteMensual(ctx, pagos)
                  mostrar(`Reporte de ${nombrePeriodo(periodo)} descargado`)
                } catch {
                  mostrar('No se pudo generar el PDF', 'error')
                } finally {
                  setGenerandoPDF(false)
                }
              }}
            >
              <Download className="size-4" aria-hidden />
              {generandoPDF ? 'Generando…' : 'Reporte PDF del mes'}
            </Boton>
            <Boton
              variante="secundario"
              disabled={!hayMovimientos}
              onClick={() => {
                const anio = Number(periodo.slice(0, 4))
                descargarReporteAnual(ctx, pagos, anio)
                mostrar(`Reporte ${anio} descargado`)
              }}
            >
              <Download className="size-4" aria-hidden />
              Reporte anual PDF
            </Boton>
            <Boton
              variante="secundario"
              disabled={!hayMovimientos}
              onClick={() => {
                descargarMovimientosCSV(transacciones, categorias, 'juanpa-finanzas-movimientos')
                mostrar('CSV descargado')
              }}
            >
              <Download className="size-4" aria-hidden />
              Todos los movimientos (CSV)
            </Boton>
          </div>
          <p className="text-xs text-tenue">
            El CSV abre directo en Excel, Numbers y Google Sheets, con acentos y montos con decimales.
          </p>
        </Tarjeta>
      </section>

      {editandoCategoria && (
        <EditorCategoria
          valor={editandoCategoria}
          onCerrar={() => setEditandoCategoria(undefined)}
          onGuardado={(nombre) => mostrar(`Categoría ${nombre} guardada`)}
        />
      )}

      <ConfirmarBorrado
        abierto={borrandoCategoria !== undefined}
        onCerrar={() => setBorrandoCategoria(undefined)}
        onConfirmar={() => {
          if (!borrandoCategoria) return
          void eliminarCategoria(borrandoCategoria.id)
            .then((resultado) => {
              void refrescar()
              return resultado
            })
            .then((resultado) =>
              mostrar(
                resultado === 'archivada'
                  ? `${borrandoCategoria.nombre} tiene movimientos, así que la archivé en vez de borrarla`
                  : `Eliminé ${borrandoCategoria.nombre}`,
                'info',
              ),
            )
        }}
        titulo="Eliminar categoría"
        mensaje={
          borrandoCategoria
            ? `Si ${borrandoCategoria.nombre} tiene movimientos registrados, se archiva en lugar de borrarse para no dejar tu historial incompleto.`
            : ''
        }
      />
    </div>
  )
}

function EditorCategoria({
  valor,
  onCerrar,
  onGuardado,
}: {
  valor: Categoria | 'nueva'
  onCerrar: () => void
  onGuardado: (nombre: string) => void
}) {
  const { refrescar } = useFinanzas()
  const editando = valor !== 'nueva' ? valor : undefined
  // El componente se monta al abrirse, así que el estado inicial basta: nunca
  // arrastra lo que se capturó en la categoría anterior.
  const [nombre, setNombre] = useState(editando?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoMovimiento>(editando?.tipo ?? 'egreso')
  const [icono, setIcono] = useState(editando?.icono ?? 'Ellipsis')
  const [color, setColor] = useState(editando?.color ?? PALETA[0])

  async function guardar() {
    if (nombre.trim() === '') return
    if (editando) {
      await actualizarCategoria(editando.id, { nombre: nombre.trim(), tipo, icono, color })
    } else {
      await crearCategoria({ nombre: nombre.trim(), tipo, icono, color })
    }
    await refrescar()
    onGuardado(nombre.trim())
    onCerrar()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo={editando ? 'Editar categoría' : 'Nueva categoría'}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <Campo etiqueta="Nombre" htmlFor="nombreCat">
          <Entrada
            id="nombreCat"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Café"
            maxLength={30}
          />
        </Campo>

        <Campo etiqueta="Tipo" htmlFor="tipoCat">
          <Selector id="tipoCat" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            <option value="egreso">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Selector>
        </Campo>

        <SelectorColor valor={color} onCambio={setColor} />

        <SelectorIcono valor={icono} onCambio={setIcono} color={color} />

        <Boton type="submit" ancho disabled={nombre.trim() === ''}>
          Guardar
        </Boton>
      </form>
    </Modal>
  )
}


/**
 * El sueldo se guardaba al salir del campo, sin señal de que hubiera pasado
 * nada. Un número del que depende todo el cálculo necesita confirmación
 * explícita: botón visible, Enter, y aviso de que quedó fijado.
 */
function CampoIngreso({
  valor,
  moneda,
  locale,
}: {
  valor: number
  moneda: string
  locale: string
}) {
  const { mostrar } = useAvisos()
  const { refrescar, guardarAjustes } = useFinanzas()
  const [texto, setTexto] = useState(valor > 0 ? String(valor / 100) : '')
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(texto)
  const cambio = centavos !== valor

  async function guardar() {
    if (!cambio) return
    setGuardando(true)
    try {
      await guardarAjustes({ ingresoMensual: centavos })
      await refrescar()
      mostrar(
        centavos > 0
          ? `Listo: cuento con ${formatearMoneda(centavos, moneda, locale, { conDecimales: false })} al mes`
          : 'Quité tu ingreso fijo; usaré tu promedio de los últimos meses',
      )
    } catch {
      mostrar('No se pudo guardar tu ingreso', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Campo
      etiqueta="Sueldo o ingreso fijo del mes"
      ayuda="Con esto sé cuánto entra aunque la nómina todavía no caiga. Déjalo en cero si tus ingresos son variables."
      htmlFor="sueldo"
    >
      <div className="flex max-w-sm items-center gap-2">
        <Entrada
          id="sueldo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void guardar()
            }
          }}
          inputMode="decimal"
          placeholder="0.00"
          className="cifras text-lg"
        />
        <Boton onClick={() => void guardar()} disabled={!cambio || guardando} className="shrink-0">
          {guardando ? 'Guardando…' : cambio ? 'Guardar' : 'Guardado'}
        </Boton>
      </div>
    </Campo>
  )
}


/**
 * Foto del dinero disponible. Guarda monto y fecha juntos: un saldo sin fecha
 * no permite saber qué movimientos ya están contados y cuáles no.
 */
function CampoSaldo({
  valor,
  fecha,
}: {
  valor: number
  fecha: string
}) {
  const { mostrar } = useAvisos()
  const { guardarAjustes } = useFinanzas()
  const [monto, setMonto] = useState(valor > 0 ? String(valor / 100) : '')
  const [fechaSaldo, setFechaSaldo] = useState(fecha)
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(monto)
  const cambio = centavos !== valor || fechaSaldo !== fecha

  async function guardar() {
    if (!cambio) return
    setGuardando(true)
    try {
      await guardarAjustes({ saldoInicial: centavos, saldoInicialFecha: fechaSaldo })
      mostrar('Saldo guardado')
    } catch {
      mostrar('No se pudo guardar el saldo', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Campo
      etiqueta="Saldo disponible a esta fecha"
      ayuda="Una foto, no un cálculo. Úsalo la primera vez y cuando quieras recalibrar."
      htmlFor="saldo"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Entrada
          id="saldo"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void guardar()
            }
          }}
          inputMode="decimal"
          placeholder="0.00"
          className="cifras w-40 text-lg"
        />
        <CampoFecha valor={fechaSaldo} onCambio={setFechaSaldo} />
        <Boton onClick={() => void guardar()} disabled={!cambio || guardando} className="shrink-0">
          {guardando ? 'Guardando…' : cambio ? 'Guardar' : 'Guardado'}
        </Boton>
      </div>
    </Campo>
  )
}

// ── Modales de cuenta ───────────────────────────────────────────────────

function ConfirmarAccion({
  abierto,
  titulo,
  mensaje,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean
  titulo: string
  mensaje: string
  textoConfirmar: string
  textoCancelar?: string
  onCerrar: () => void
  onConfirmar: () => void | Promise<void>
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <p className="text-[14px] text-suave">{mensaje}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>
          {textoCancelar}
        </Boton>
        <Boton variante="peligro" onClick={() => void onConfirmar()}>
          {textoConfirmar}
        </Boton>
      </div>
    </Modal>
  )
}

function EditarNombre({
  inicial,
  onCerrar,
  onGuardado,
}: {
  inicial: string
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const { mostrar } = useAvisos()
  const [nombre, setNombre] = useState(inicial)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const limpio = nombre.trim()
    if (limpio === '' || limpio === inicial) {
      onCerrar()
      return
    }
    setGuardando(true)
    const res = await api.patch<{ user: { displayName: string } }>('/auth/perfil', {
      displayName: limpio,
    })
    setGuardando(false)
    if (!res.ok) {
      mostrar(res.error ?? 'No se pudo guardar', 'error')
      return
    }
    await onGuardado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Editar nombre">
      <Campo etiqueta="Cómo quieres que te diga la app" htmlFor="nuevo-nombre">
        <Entrada
          id="nuevo-nombre"
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={80}
        />
      </Campo>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </Modal>
  )
}

function CambiarPassword({
  onCerrar,
  onGuardado,
}: {
  onCerrar: () => void
  onGuardado: () => void
}) {
  const { mostrar } = useAvisos()
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
      mostrar(res.error ?? 'No se pudo cambiar la contraseña', 'error')
      return
    }
    onGuardado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Cambiar contraseña">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <Campo etiqueta="Contraseña actual" htmlFor="actual">
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
              aria-label={mostrarPw ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
            >
              {mostrarPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Campo>
        <Campo
          etiqueta="Nueva contraseña"
          htmlFor="nuevo"
          ayuda="8+ caracteres, mayúscula, minúscula y un número."
          error={nuevo.length > 0 && !cumple ? 'No cumple la política.' : undefined}
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
          etiqueta="Repite la nueva contraseña"
          htmlFor="confirmar"
          error={!coinciden ? 'No coinciden.' : undefined}
        >
          <Entrada
            id="confirmar"
            type={mostrarPw ? 'text' : 'password'}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </Campo>
        <p className="text-[13px] text-tenue">
          Al guardar, las otras sesiones abiertas en otros dispositivos se cerrarán.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!listo || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function EliminarCuenta({
  onCerrar,
  onEliminado,
}: {
  onCerrar: () => void
  onEliminado: () => void
}) {
  const { mostrar } = useAvisos()
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
      mostrar(res.error ?? 'No se pudo eliminar la cuenta', 'error')
      return
    }
    onEliminado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Eliminar tu cuenta">
      <p className="text-[14px] text-suave">
        Esto borra tu cuenta y todos los movimientos, categorías, deudas y metas asociados.
        No se puede deshacer.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void eliminar()
        }}
        className="mt-4 space-y-4"
      >
        <Campo etiqueta="Tu contraseña" htmlFor="pw-eliminar">
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
          etiqueta='Escribe "ELIMINAR" para confirmar'
          htmlFor="confirmar-eliminar"
          error={confirmar.length > 0 && confirmar !== 'ELIMINAR' ? 'Debe ser exactamente ELIMINAR.' : undefined}
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
            Cancelar
          </Boton>
          <Boton variante="peligro" type="submit" disabled={!listo || eliminando}>
            {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function CambiarCorreo({
  correoActual,
  onCerrar,
  onEnviado,
}: {
  correoActual: string
  onCerrar: () => void
  onEnviado: () => void
}) {
  const { mostrar } = useAvisos()
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
      mostrar(res.error ?? 'No se pudo solicitar el cambio', 'error')
      return
    }
    onEnviado()
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Cambiar correo">
      <p className="text-[14px] text-suave">
        Te enviaremos un enlace de verificación al <strong>nuevo</strong> correo. Tu correo actual
        no cambia hasta que piques ese enlace.
      </p>
      <form onSubmit={enviar} className="mt-4 space-y-4">
        <Campo etiqueta="Correo actual" htmlFor="correo-actual">
          <Entrada id="correo-actual" type="email" value={correoActual} disabled />
        </Campo>
        <Campo etiqueta="Correo nuevo" htmlFor="correo-nuevo">
          <Entrada
            id="correo-nuevo"
            type="email"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="nuevo@correo.com"
            autoComplete="email"
            required
          />
        </Campo>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="fantasma" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!listo || enviando}>
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
