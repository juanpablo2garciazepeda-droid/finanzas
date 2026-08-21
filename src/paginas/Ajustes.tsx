import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Bell,
  ChevronRight,
  Database,
  Download,
  FileDown,
  FileUp,
  Folder,
  Mail,
  Palette,
  Pencil,
  Plus,
  Repeat,
  Shield,
  ShieldOff,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import type { Acento, Categoria, TipoMovimiento } from '@/dominio/tipos'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { hoyISO, nombrePeriodo } from '@/dominio/fechas'
import { PALETA } from '@/datos/categoriasIniciales'
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  exportarMisDatos,
  importarMovimientosCsv,
} from '@/datos/repositorio'
import { Avatar } from '@/componentes/Avatar'
import { useEditorPerfil } from '@/estado/editorPerfil'
import { SeccionDesplegable } from '@/componentes/SeccionDesplegable'
import { api } from '@/api/cliente'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { hayNotificaciones, pedirPermiso } from '@/estado/recordatorios'
import { useI18n, useT } from '@/estado/i18n'
import { MUESTRA_ACENTO, useEsOscuro } from '@/estado/tema'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import {
  Boton,
  Campo,
  Entrada,
  EntradaMoneda,
  Selector,
  Tarjeta,
  TituloSeccion,
  clases,
} from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
import { Segmentado } from '@/componentes/ui/Segmentado'
import { SelectorColor, SelectorIcono } from '@/componentes/ui/Selectores'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'
import { descargarMovimientosCSV } from '@/exportar/csv'

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
  const { usuario, refrescar: refrescarAuth } = useAuth()
  const i18n = useI18n()
  const t = i18n.t
  const esOscuro = useEsOscuro()
  const editorPerfil = useEditorPerfil()
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | 'nueva' | undefined>()
  const [borrandoCategoria, setBorrandoCategoria] = useState<Categoria | undefined>()
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [importando, setImportando] = useState(false)

  return (
    <div className="space-y-6">
      {/* ── 1. Perfil ─────────────────────────────────────────────────── */}
      <section>
        <TituloSeccion>{t('ajustes.tu_perfil')}</TituloSeccion>
        <Tarjeta>
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            <Avatar
              nombre={usuario?.displayName || usuario?.email || '?'}
              foto={usuario?.fotoUrl}
              tamano="xl"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold text-tinta">
                {usuario?.displayName || t('ajustes.sin_nombre')}
              </p>
              <p className="truncate text-sm text-suave">{usuario?.email}</p>
              {usuario && !usuario.emailVerificado && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-ambar/10 px-2 py-0.5 text-[12px] text-ambar">
                  <X className="size-3" aria-hidden />
                  {t('ajustes.correo_sin_verificar')}
                </p>
              )}
              {usuario?.emailVerificado && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-verde/10 px-2 py-0.5 text-[12px] text-verde">
                  <ShieldOff className="size-3 -scale-x-100" aria-hidden />
                  {t('ajustes.correo_verificado')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => editorPerfil.abrir()}
              className="shrink-0 rounded-md px-3 py-1.5 text-[14px] font-medium text-acento transition-colors hover:bg-acento/10"
            >
              {t('ajustes.editar_perfil')}
            </button>
          </div>
        </Tarjeta>
      </section>

      {/* ── 2. Apariencia (combina Moneda + Idioma + Tema + Acento) ─── */}
      <SeccionDesplegable
        icono={Palette}
        titulo={t('ajustes.apariencia')}
        subtitulo={t('ajustes.apariencia_ayuda')}
      >
        <Tarjeta className="space-y-5">
          <p className="text-[13px] text-tenue">{t('ajustes.apariencia_ayuda')}</p>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">
              {t('ajustes.idioma')}
            </span>
            <Segmentado
              etiqueta={t('ajustes.idioma')}
              valor={i18n.idioma}
              onCambiar={(v) => void i18n.setIdioma(v as 'es' | 'en')}
              opciones={[
                { valor: 'es', etiqueta: t('ajustes.idioma_es') },
                { valor: 'en', etiqueta: t('ajustes.idioma_en') },
              ]}
            />
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">
              {t('ajustes.tema')}
            </span>
            <Segmentado
              etiqueta={t('ajustes.tema')}
              valor={ajustes.tema}
              onCambiar={(tema) => void guardarAjustes({ tema })}
              opciones={(['claro', 'oscuro', 'sistema'] as const).map((valor) => ({
                valor,
                etiqueta: t(`tema.${valor}`),
              }))}
            />
          </div>

          <div>
            <span className="mb-2 block text-[13px] font-medium text-suave">
              {t('ajustes.color_acento')}
            </span>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t('ajustes.color_acento')}>
              {(Object.keys(MUESTRA_ACENTO) as Acento[]).map((opcion) => {
                const muestra = MUESTRA_ACENTO[opcion]
                const activo = ajustes.acento === opcion
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={t(`acento.${opcion}`)}
                    title={t(`acento.${opcion}`)}
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
          </div>

          <div>
            <Campo etiqueta={t('ajustes.moneda')} htmlFor="moneda">
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
            <p className="mt-1.5 text-xs text-tenue">
              {t('ajustes.moneda_ayuda', {
                ejemplo: formatearMoneda(123456, ajustes.moneda, ajustes.locale),
              })}
            </p>
          </div>
        </Tarjeta>
      </SeccionDesplegable>

      {/* ── 3. Tu dinero (combina Saldo + Ingreso + Ciclo) ──────────── */}
      <SeccionDesplegable
        icono={Wallet}
        titulo={t('ajustes.tu_dinero')}
        subtitulo={t('ajustes.tu_dinero_ayuda')}
      >
        <Tarjeta className="space-y-4">
          <p className="text-[13px] text-tenue">{t('ajustes.tu_dinero_ayuda')}</p>

          <CampoSaldo
            valor={ajustes.saldoInicial}
            fecha={ajustes.saldoInicialFecha}
          />

          <div className="border-t border-borde pt-4">
            <CampoIngreso
              valor={ajustes.ingresoMensual}
              moneda={ajustes.moneda}
              locale={ajustes.locale}
            />
          </div>

          <div className="border-t border-borde pt-4">
            <span className="mb-2 block text-[13px] font-medium text-suave">
              {t('ajustes.cada_cuanto')}
            </span>
            <Segmentado
              etiqueta={t('ajustes.cada_cuanto')}
              valor={ajustes.cicloPago}
              onCambiar={(cicloPago) => void guardarAjustes({ cicloPago })}
              opciones={(['semanal', 'quincenal', 'mensual'] as const).map((valor) => ({
                valor,
                etiqueta: t(`ciclo.${valor}`),
              }))}
            />
            <p className="mt-1.5 text-[13px] text-tenue">{t('ajustes.ciclo_ayuda')}</p>
          </div>
        </Tarjeta>
      </SeccionDesplegable>

      {/* ── 4. Alertas (combina Semáforo + Recordatorios) ───────────── */}
      <SeccionDesplegable
        icono={Bell}
        titulo={t('ajustes.alertas')}
        subtitulo={t('ajustes.alertas_ayuda')}
      >
        <Tarjeta className="space-y-5">
          <p className="text-[13px] text-tenue">{t('ajustes.alertas_ayuda')}</p>

          <Campo
            etiqueta={t('ajustes.ventana_etiqueta')}
            ayuda={t('ajustes.ventana_ayuda')}
            htmlFor="dias"
          >
            <div className="flex items-center gap-3">
              <input
                id="dias"
                type="range"
                min={1}
                max={30}
                value={ajustes.diasAvisoVencimiento}
                onChange={(e) =>
                  void guardarAjustes({ diasAvisoVencimiento: Number(e.target.value) })
                }
                className="flex-1 accent-acento"
              />
              <span className="cifras w-16 text-right text-sm text-tinta">
                {t('ajustes.dias', { n: ajustes.diasAvisoVencimiento })}
              </span>
            </div>
          </Campo>

          <Campo
            etiqueta={t('ajustes.umbral_etiqueta')}
            ayuda={t('ajustes.umbral_ayuda')}
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
                onChange={(e) =>
                  void guardarAjustes({ umbralPrecaucion: Number(e.target.value) / 100 })
                }
                className="flex-1 accent-acento"
              />
              <span className="cifras w-16 text-right text-sm text-tinta">
                {Math.round(ajustes.umbralPrecaucion * 100)}%
              </span>
            </div>
          </Campo>

          <div className="border-t border-borde pt-4">
            <label className="flex items-start gap-3">
              <Bell className="mt-0.5 size-4 text-tenue" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm text-tinta">{t('ajustes.avisar_pagos')}</span>
                <span className="mt-0.5 block text-xs text-tenue">
                  {hayNotificaciones() ? t('ajustes.avisar_ayuda') : t('ajustes.sin_notificaciones')}
                </span>
              </span>
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
                    await guardarAjustes({
                      notificacionesActivas: true,
                      ultimaRevisionVencimientos: '',
                    })
                    mostrar(t('aviso.avisare_pagos'))
                  } else {
                    mostrar(t('aviso.notificaciones_bloqueadas'), 'error')
                  }
                }}
                disabled={!hayNotificaciones()}
                className="size-4 shrink-0 accent-acento"
              />
            </label>
          </div>

          {/* El correo va aparte del permiso del navegador: aquel solo se
              dispara con la app abierta, y quien lleva una semana sin abrirla
              es justo quien necesita el recordatorio. */}
          <div className="border-t border-borde pt-4">
            <label className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 text-tenue" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm text-tinta">{t('ajustes.avisos_correo')}</span>
                <span className="mt-0.5 block text-xs text-tenue">
                  {t('ajustes.avisos_correo_ayuda', { n: ajustes.diasAvisoVencimiento })}
                </span>
              </span>
              <input
                type="checkbox"
                checked={ajustes.avisosCorreoVencimientos}
                onChange={(e) => {
                  void guardarAjustes({ avisosCorreoVencimientos: e.target.checked })
                  mostrar(t(e.target.checked ? 'aviso.correo_pagos_si' : 'aviso.correo_pagos_no'))
                }}
                className="size-4 shrink-0 accent-acento"
              />
            </label>
          </div>

          <div className="border-t border-borde pt-4">
            <label className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 text-tenue" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm text-tinta">{t('ajustes.resumen_semanal')}</span>
                <span className="mt-0.5 block text-xs text-tenue">
                  {t('ajustes.resumen_ayuda')}
                </span>
              </span>
              {usuario && (
                <input
                  type="checkbox"
                  checked={usuario.recibirDigest}
                  onChange={async (e) => {
                    const r = await api.patch<{ user: { recibirDigest: boolean } }>(
                      '/auth/perfil',
                      { recibirDigest: e.target.checked },
                    )
                    if (r.ok) {
                      await refrescarAuth()
                      mostrar(t(e.target.checked ? 'aviso.resumen_si' : 'aviso.resumen_no'))
                    }
                  }}
                  className="size-4 shrink-0 accent-acento"
                />
              )}
            </label>
          </div>
        </Tarjeta>
      </SeccionDesplegable>

      {/* ── 5. Categorías ───────────────────────────────────────────── */}
      <SeccionDesplegable
        icono={Folder}
        titulo={t('ajustes.categorias_mostrar')}
        subtitulo={`${t('ajustes.categorias')} · ${categorias.length}`}
      >
        <Tarjeta className="p-0">
          <div className="flex items-center justify-between border-b border-borde px-4 py-2.5">
            <span className="text-sm text-tinta">{t('ajustes.categorias')}</span>
            <Boton
              variante="secundario"
              onClick={() => setEditandoCategoria('nueva')}
              className="px-3 py-1 text-[13px]"
            >
              <Plus className="size-3.5" aria-hidden />
              {t('ajustes.nueva_categoria')}
            </Boton>
          </div>
          <div className="divide-y divide-borde">
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
                  {t(categoria.tipo === 'ingreso' ? 'comun.ingreso' : 'comun.gasto')}
                </span>
                <button
                  type="button"
                  onClick={() => setEditandoCategoria(categoria)}
                  aria-label={t('ajustes.editar_nombre_cat', { nombre: categoria.nombre })}
                  className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-elevada hover:text-tinta"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setBorrandoCategoria(categoria)}
                  aria-label={t('ajustes.eliminar_nombre_cat', { nombre: categoria.nombre })}
                  className="rounded-lg p-1.5 text-tenue transition-colors hover:bg-rojo/10 hover:text-rojo"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </Tarjeta>
      </SeccionDesplegable>

      {/* ── 7. Automatización (plantillas recurrentes) ───────────────── */}
      <section>
        <TituloSeccion>{t('ajustes.automatizacion')}</TituloSeccion>
        <Link
          to="/recurrentes"
          className="flex items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta transition-colors hover:bg-elevada sm:p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-acento/10 text-acento">
              <Repeat className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-tinta">{t('ajustes.recurrentes_desc')}</p>
              <p className="mt-0.5 text-[13px] text-tenue">
                {t('ajustes.recurrentes_ayuda')}
              </p>
            </div>
          </div>
          <ChevronRight className="size-5 text-suave" aria-hidden />
        </Link>
      </section>

      {/* ── 7b. Administración ───────────────────────────────────────
          Solo para `rol: 'admin'`. En escritorio el panel también cuelga de
          la barra lateral, pero en móvil no hay barra: sin esta tarjeta un
          admin con teléfono se quedaba sin camino al panel. */}
      {usuario?.rol === 'admin' && (
        <section>
          <TituloSeccion>{t('admin.titulo')}</TituloSeccion>
          <Link
            to="/admin"
            className="flex items-center justify-between gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta transition-colors hover:bg-elevada sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-acento/10 text-acento">
                <Shield className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-tinta">{t('admin.entrar_panel')}</p>
                <p className="mt-0.5 text-[13px] text-tenue">{t('admin.ayuda')}</p>
              </div>
            </div>
            <ChevronRight className="size-5 text-suave" aria-hidden />
          </Link>
        </section>
      )}

      {/* ── 8. Tus datos (exportar, importar, reportes) ──────────────── */}
      <SeccionDesplegable
        icono={Database}
        titulo={t('ajustes.tus_datos')}
        subtitulo={t('ajustes.tus_datos_ayuda')}
      >
        <Tarjeta className="space-y-4">
          <p className="text-[13px] text-tenue">{t('ajustes.tus_datos_ayuda')}</p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-tinta">{t('ajustes.exportar_desc')}</p>
              <p className="mt-0.5 text-[13px] text-tenue">
                {t('ajustes.exportar_ayuda')}
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
                  a.download = `finanzas-gz-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  mostrar(t('aviso.descarga_iniciada'))
                } catch (err) {
                  mostrar(err instanceof Error ? err.message : t('aviso.no_exportar'), 'error')
                } finally {
                  setExportando(false)
                }
              }}
            >
              <FileDown className="size-4" aria-hidden />
              {exportando ? t('ajustes.exportando') : t('ajustes.exportar_todo')}
            </Boton>
          </div>

          <div className="border-t border-borde pt-3">
            <label className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-tinta">{t('ajustes.importar_desc')}</p>
                <p className="mt-0.5 text-[13px] text-tenue">
                  {t('ajustes.columnas')}{' '}
                  <code className="rounded bg-elevada px-1">
                    fecha, tipo, monto, categoria, metodoPago, nota
                  </code>
                  . {t('ajustes.importar_ayuda')}
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
                        t('aviso.import_ok', {
                          n: r.insertadas,
                          m: r.categoriasCreadas.length,
                        }),
                      )
                      if (r.errores.length > 0) {
                        mostrar(t('aviso.import_errores', { n: r.errores.length }), 'error')
                        // eslint-disable-next-line no-console
                        console.warn('Errores de importación:', r.errores)
                      }
                      await refrescar()
                    } catch (err) {
                      mostrar(
                        err instanceof Error ? err.message : t('aviso.no_importar'),
                        'error',
                      )
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
                  {importando ? t('ajustes.importando') : t('ajustes.elegir_archivo')}
                </Boton>
              </span>
            </label>
          </div>

          <div className="border-t border-borde pt-3">
            <p className="mb-2 text-sm text-tinta">{t('ajustes.exportar')}</p>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="secundario"
                disabled={!hayMovimientos || generandoPDF}
                onClick={async () => {
                  setGenerandoPDF(true)
                  try {
                    const { descargarReporteMensual } = await import('@/exportar/pdf')
                    descargarReporteMensual(ctx, pagos)
                    mostrar(t('aviso.reporte_descargado', { periodo: nombrePeriodo(periodo) }))
                  } catch {
                    mostrar(t('aviso.no_pdf'), 'error')
                  } finally {
                    setGenerandoPDF(false)
                  }
                }}
              >
                <Download className="size-4" aria-hidden />
                {generandoPDF ? t('ajustes.generando') : t('ajustes.reporte_mes')}
              </Boton>
              <Boton
                variante="secundario"
                disabled={!hayMovimientos || generandoPDF}
                onClick={async () => {
                  const anio = Number(periodo.slice(0, 4))
                  setGenerandoPDF(true)
                  try {
                    const { descargarReporteAnual } = await import('@/exportar/pdf')
                    descargarReporteAnual(ctx, pagos, anio)
                    mostrar(t('aviso.reporte_anual_descargado', { anio }))
                  } catch {
                    mostrar(t('aviso.no_pdf'), 'error')
                  } finally {
                    setGenerandoPDF(false)
                  }
                }}
              >
                <Download className="size-4" aria-hidden />
                {t('ajustes.reporte_anual')}
              </Boton>
              <Boton
                variante="secundario"
                disabled={!hayMovimientos}
                onClick={() => {
                  descargarMovimientosCSV(transacciones, categorias, 'finanzas-gz-movimientos')
                  mostrar(t('aviso.csv_descargado'))
                }}
              >
                <Download className="size-4" aria-hidden />
                {t('ajustes.movimientos_csv')}
              </Boton>
            </div>
            <p className="mt-2 text-xs text-tenue">{t('ajustes.csv_ayuda')}</p>
          </div>
        </Tarjeta>
      </SeccionDesplegable>

      {editandoCategoria && (
        <EditorCategoria
          valor={editandoCategoria}
          onCerrar={() => setEditandoCategoria(undefined)}
          onGuardado={(nombre) => mostrar(t('aviso.categoria_guardada', { nombre }))}
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
                t(
                  resultado === 'archivada' ? 'aviso.categoria_archivada' : 'aviso.categoria_eliminada',
                  { nombre: borrandoCategoria.nombre },
                ),
                'info',
              ),
            )
        }}
        titulo={t('ajustes.eliminar_categoria')}
        mensaje={
          borrandoCategoria
            ? t('ajustes.borrar_cat_mensaje', { nombre: borrandoCategoria.nombre })
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
  const t = useT()
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
    <Modal abierto onCerrar={onCerrar} titulo={t(editando ? 'ajustes.editar_categoria' : 'ajustes.nueva_categoria')}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="space-y-4"
      >
        <Campo etiqueta={t('comun.nombre')} htmlFor="nombreCat">
          <Entrada
            id="nombreCat"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t('ajustes.categoria_placeholder')}
            maxLength={30}
          />
        </Campo>

        <Campo etiqueta={t('comun.tipo')} htmlFor="tipoCat">
          <Selector id="tipoCat" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            <option value="egreso">{t('comun.gasto')}</option>
            <option value="ingreso">{t('comun.ingreso')}</option>
          </Selector>
        </Campo>

        <SelectorColor valor={color} onCambio={setColor} />

        <SelectorIcono valor={icono} onCambio={setIcono} color={color} />

        <Boton type="submit" ancho disabled={nombre.trim() === ''}>
          {t('comun.guardar')}
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
  const t = useT()
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
          ? t('aviso.ingreso_ok', {
              monto: formatearMoneda(centavos, moneda, locale, { conDecimales: 'auto' }),
            })
          : t('aviso.ingreso_quitado'),
      )
    } catch {
      mostrar(t('aviso.no_ingreso'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Campo
      etiqueta={t('ajustes.sueldo_etiqueta')}
      ayuda={t('ajustes.sueldo_ayuda')}
      htmlFor="sueldo"
    >
      <div className="flex max-w-sm items-center gap-2">
        <EntradaMoneda
          id="sueldo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void guardar()
            }
          }}
          placeholder="0.00"
          className="cifras text-lg"
        />
        <Boton onClick={() => void guardar()} disabled={!cambio || guardando} className="shrink-0">
          {guardando ? t('comun.guardando') : cambio ? t('comun.guardar') : t('comun.guardado')}
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
  const t = useT()
  const [monto, setMonto] = useState(valor > 0 ? String(valor / 100) : '')
  // El form puede llegar con `fecha` vacía pero `valor` > 0 (datos viejos
  // guardados antes de que la fecha fuera obligatoria). En ese caso inicial
  // con vacío para que el aviso "falta fecha" sea visible y el usuario lo
  // corrija; al teclear monto se autollena a hoy.
  const [fechaSaldo, setFechaSaldo] = useState(fecha)
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(monto)
  // Guardar requiere monto Y fecha: un saldo sin fecha no es saldo, es un
  // número sin ancla temporal. El backend lo aceptaba y el sistema lo
  // ignoraba por completo, así que el usuario pensaba haberlo guardado.
  const hayMonto = centavos > 0
  const hayFecha = fechaSaldo !== ''
  const faltaFecha = hayMonto && !hayFecha
  const cambio = centavos !== valor || fechaSaldo !== fecha
  const puedeGuardar = cambio && hayFecha && centavos >= 0

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      await guardarAjustes({ saldoInicial: centavos, saldoInicialFecha: fechaSaldo })
      mostrar(t('aviso.saldo_guardado'))
    } catch {
      mostrar(t('aviso.no_saldo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Campo
      etiqueta={t('ajustes.saldo_etiqueta')}
      ayuda={t('ajustes.saldo_ayuda')}
      htmlFor="saldo"
    >
      <div className="flex flex-wrap items-center gap-2">
        <EntradaMoneda
          id="saldo"
          value={monto}
          onChange={(e) => {
            const nuevo = e.target.value
            setMonto(nuevo)
            // Si el usuario empieza a teclear un monto y aún no hay fecha,
            // asumimos "hoy": es el ancla más conservadora (cuenta todos los
            // movimientos desde este momento). El usuario puede cambiarla
            // después si la quiere atrás.
            if (aCentavos(nuevo) > 0 && fechaSaldo === '') {
              setFechaSaldo(hoyISO())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void guardar()
            }
          }}
          placeholder="0.00"
          className="cifras w-40 text-lg"
        />
        <CampoFecha valor={fechaSaldo} onCambio={setFechaSaldo} />
        <Boton onClick={() => void guardar()} disabled={!puedeGuardar || guardando} className="shrink-0">
          {guardando ? t('comun.guardando') : cambio && hayFecha ? t('comun.guardar') : t('comun.guardado')}
        </Boton>
      </div>
      {/* Aviso cuando hay monto sin fecha: sin esto el saldo se guarda pero
          el sistema lo ignora por completo (calcularSaldo devuelve
          `declarado: false`). El usuario quedaba pensando que su dinero
          estaba registrado. */}
      {faltaFecha && (
        <p className="mt-2 flex items-start gap-2 text-[13px] text-ambar">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('ajustes.saldo_sin_fecha_aviso')}
          </span>
        </p>
      )}
    </Campo>
  )
}

