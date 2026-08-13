import { useRef, useState } from 'react'
import { Download, LockKeyhole, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { Acento, Categoria, TipoMovimiento } from '@/dominio/tipos'
import { aCentavos, formatearMoneda } from '@/dominio/dinero'
import { hoyISO, nombrePeriodo } from '@/dominio/fechas'
import { NOMBRE_CICLO } from '@/dominio/ciclos'
import { PALETA } from '@/datos/categoriasIniciales'
import {
  actualizarCategoria,
  borrarTodo,
  crearCategoria,
  eliminarCategoria,
  exportarRespaldo,
  guardarAjustes,
  importarRespaldo,
  type Respaldo,
} from '@/datos/repositorio'
import { cargarDatosDemo } from '@/datos/demo'
import { useAvisos } from '@/estado/avisos'
import { useFinanzas } from '@/estado/finanzas'
import { hayNotificaciones, pedirPermiso } from '@/estado/recordatorios'
import { MUESTRA_ACENTO, NOMBRE_TEMA, useEsOscuro } from '@/estado/tema'
import { fijarPin, hayPin, quitarPin } from '@/estado/bloqueo'
import { FormularioPin } from '@/componentes/PantallaBloqueo'
import { CampoFecha } from '@/componentes/ui/CampoFecha'
import { Boton, Campo, Entrada, Selector, Tarjeta, TituloSeccion, clases } from '@/componentes/ui/Basicos'
import { Icono } from '@/componentes/ui/Icono'
import { SelectorColor, SelectorIcono } from '@/componentes/ui/Selectores'
import { ConfirmarBorrado, Modal } from '@/componentes/ui/Modal'
import { descargar, descargarMovimientosCSV } from '@/exportar/csv'

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
  const { ajustes, categorias, transacciones, ctx, pagos, periodo, hayMovimientos } = useFinanzas()
  const { mostrar } = useAvisos()
  const esOscuro = useEsOscuro()
  const archivo = useRef<HTMLInputElement>(null)
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | 'nueva' | undefined>()
  const [borrandoCategoria, setBorrandoCategoria] = useState<Categoria | undefined>()
  const [borrandoTodo, setBorrandoTodo] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [editandoPin, setEditandoPin] = useState(false)
  const [pinActivo, setPinActivo] = useState(hayPin)

  async function importar(entrada: File) {
    try {
      const respaldo = JSON.parse(await entrada.text()) as Respaldo
      await importarRespaldo(respaldo)
      mostrar('Respaldo restaurado')
    } catch (error) {
      mostrar(error instanceof Error ? error.message : 'El archivo no es un respaldo válido', 'error')
    }
  }

  return (
    <div className="space-y-6">
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
            <span className="mb-2 block text-[13px] font-medium text-suave">Tema</span>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-elevada p-1">
              {(['claro', 'oscuro', 'sistema'] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={ajustes.tema === opcion}
                  onClick={() => void guardarAjustes({ tema: opcion })}
                  className={clases(
                    'rounded-full py-2 text-[15px] font-medium transition-colors',
                    ajustes.tema === opcion
                      ? 'bg-superficie text-tinta shadow-sm'
                      : 'text-suave hover:text-tinta',
                  )}
                >
                  {NOMBRE_TEMA[opcion]}
                </button>
              ))}
            </div>
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
            moneda={ajustes.moneda}
            locale={ajustes.locale}
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
            <div className="grid grid-cols-3 gap-1 rounded-full bg-elevada p-1">
              {(['semanal', 'quincenal', 'mensual'] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={ajustes.cicloPago === opcion}
                  onClick={() => void guardarAjustes({ cicloPago: opcion })}
                  className={clases(
                    'rounded-full py-2 text-[15px] font-medium transition-colors',
                    ajustes.cicloPago === opcion
                      ? 'bg-superficie text-tinta shadow-sm'
                      : 'text-suave hover:text-tinta',
                  )}
                >
                  {NOMBRE_CICLO[opcion]}
                </button>
              ))}
            </div>
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
        <TituloSeccion>Bloqueo</TituloSeccion>
        <Tarjeta className="space-y-3">
          {pinActivo ? (
            <>
              <p className="text-[15px] text-tinta">
                La app pide un PIN de 4 dígitos al abrirse en este dispositivo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={() => setEditandoPin(true)}>
                  Cambiar PIN
                </Boton>
                <Boton
                  variante="peligro"
                  onClick={() => {
                    quitarPin()
                    setPinActivo(false)
                    mostrar('Quité el PIN; la app ya no lo pedirá', 'info')
                  }}
                >
                  Quitar PIN
                </Boton>
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] text-suave">
                Pon un PIN para que quien tome tu teléfono no vea tus finanzas.
              </p>
              <Boton variante="secundario" onClick={() => setEditandoPin(true)}>
                <LockKeyhole className="size-4" aria-hidden />
                Activar PIN
              </Boton>
            </>
          )}
          <p className="text-[13px] text-tenue">
            Es un candado de pantalla, no una cuenta: no hay servidor que valide nada y los datos
            siguen guardados sin cifrar en este navegador. Sirve contra miradas ajenas, no contra
            alguien decidido con acceso al dispositivo.
          </p>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Recordatorios de pago</TituloSeccion>
        <Tarjeta>
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
              <span className="block text-sm text-tinta">Avisarme de pagos próximos</span>
              <span className="mt-1 block text-xs text-tenue">
                {hayNotificaciones()
                  ? 'La app no tiene servidor, así que el aviso llega la primera vez que la abres cada día, no a una hora fija.'
                  : 'Este navegador no soporta notificaciones.'}
              </span>
            </span>
          </label>
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

      <section>
        <TituloSeccion>Respaldo</TituloSeccion>
        <Tarjeta className="space-y-3">
          <p className="text-sm text-suave">
            Tus datos viven solo en este navegador. Si borras los datos del sitio o cambias de dispositivo, se
            van contigo únicamente si haces respaldo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              onClick={async () => {
                const respaldo = await exportarRespaldo()
                descargar(
                  JSON.stringify(respaldo, null, 2),
                  `juanpa-finanzas-respaldo-${respaldo.generado.slice(0, 10)}.json`,
                  'application/json',
                )
                mostrar('Respaldo descargado')
              }}
            >
              <Download className="size-4" aria-hidden />
              Descargar respaldo
            </Boton>
            <Boton variante="secundario" onClick={() => archivo.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Restaurar respaldo
            </Boton>
            <input
              ref={archivo}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const elegido = e.target.files?.[0]
                if (elegido) void importar(elegido)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-tenue">Restaurar reemplaza todo lo que hay ahora.</p>
        </Tarjeta>
      </section>

      <section>
        <TituloSeccion>Zona de riesgo</TituloSeccion>
        <Tarjeta className="space-y-3">
          {!hayMovimientos && (
            <Boton
              variante="secundario"
              onClick={async () => {
                await cargarDatosDemo()
                mostrar('Cargué cuatro meses de ejemplo')
              }}
            >
              Cargar datos de ejemplo
            </Boton>
          )}
          <Boton variante="peligro" onClick={() => setBorrandoTodo(true)}>
            <Trash2 className="size-4" aria-hidden />
            Borrar todos mis datos
          </Boton>
        </Tarjeta>
      </section>

      {editandoPin && (
        <Modal
          abierto
          onCerrar={() => setEditandoPin(false)}
          titulo={pinActivo ? 'Cambiar PIN' : 'Activar PIN'}
          ancho="sm:max-w-sm"
        >
          <FormularioPin
            onCancelar={() => setEditandoPin(false)}
            onGuardar={(pin) => {
              void fijarPin(pin).then(() => {
                setPinActivo(true)
                setEditandoPin(false)
                mostrar('PIN activado; te lo pediré la próxima vez que abras la app')
              })
            }}
          />
        </Modal>
      )}

      {/* Se monta al abrirse para que no arrastre la categoría anterior. */}
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
          void eliminarCategoria(borrandoCategoria.id).then((resultado) =>
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

      <ConfirmarBorrado
        abierto={borrandoTodo}
        onCerrar={() => setBorrandoTodo(false)}
        onConfirmar={() => {
          void borrarTodo().then(() => mostrar('Listo, la app quedó como recién instalada', 'info'))
        }}
        titulo="Borrar todos mis datos"
        mensaje="Se borran movimientos, presupuestos, deudas y metas de este dispositivo. Descarga un respaldo antes si quieres poder volver."
        textoBoton="Borrar todo"
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
  const [texto, setTexto] = useState(valor > 0 ? String(valor / 100) : '')
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(texto)
  const cambio = centavos !== valor

  async function guardar() {
    if (!cambio) return
    setGuardando(true)
    try {
      await guardarAjustes({ ingresoMensual: centavos })
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
  moneda,
  locale,
}: {
  valor: number
  fecha: string
  moneda: string
  locale: string
}) {
  const { mostrar } = useAvisos()
  const [texto, setTexto] = useState(valor > 0 ? String(valor / 100) : '')
  const [dia, setDia] = useState(fecha || hoyISO())
  const [guardando, setGuardando] = useState(false)

  const centavos = aCentavos(texto)
  const cambio = centavos !== valor || dia !== fecha

  async function guardar() {
    if (!cambio) return
    setGuardando(true)
    try {
      await guardarAjustes({ saldoInicial: centavos, saldoInicialFecha: centavos > 0 ? dia : '' })
      mostrar(
        centavos > 0
          ? `Listo: parto de ${formatearMoneda(centavos, moneda, locale, { conDecimales: false })}`
          : 'Quité tu saldo; volveré a calcular solo con entradas y salidas',
      )
    } catch {
      mostrar('No se pudo guardar tu saldo', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-3">
      <Campo
        etiqueta="¿Cuánto tienes ahora en el banco y en efectivo?"
        ayuda="Súmalo todo: cuenta, tarjeta de débito y efectivo."
        htmlFor="saldo"
      >
        <div className="flex max-w-sm items-center gap-2">
          <Entrada
            id="saldo"
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

      <div className="max-w-[16rem]">
        <Campo etiqueta="¿De qué día es ese saldo?" htmlFor="saldoFecha">
          <CampoFecha id="saldoFecha" valor={dia} onCambio={setDia} max={hoyISO()} locale={locale} />
        </Campo>
      </div>
    </div>
  )
}
