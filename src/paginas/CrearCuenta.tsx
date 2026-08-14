import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Boton, Entrada, clases } from '@/componentes/ui/Basicos'
import { MedidorFortaleza, fortalezaPassword } from '@/componentes/FortalezaPassword'
import { Avatar } from '@/componentes/Avatar'
import { BarraPublica } from './Landing'
import { useAuth } from '@/estado/auth'
import { useAvisos } from '@/estado/avisos'
import { MENSAJE_ERROR_FOTO, prepararFotoPerfil } from '@/utilidades/imagen'

/**
 * Alta de cuenta, una pregunta por pantalla.
 *
 * El correo se confirma en el acto: se escribe, sale el código, se teclea y
 * recién entonces se piden contraseña y foto. Confirmarlo al final —como
 * estaba— tenía dos problemas. Uno, quien se equivocaba de correo no se
 * enteraba hasta después de haber inventado una contraseña y subido una foto.
 * Dos, la cuenta ya existía cuando llegaba el correo, así que cada persona que
 * abandonaba a mitad dejaba un usuario sin verificar en la base.
 *
 * Ahora la cuenta se crea en el último paso, ya con el correo confirmado, y
 * nace con la sesión abierta.
 */

type Paso = 'nombre' | 'correo' | 'codigo' | 'password' | 'foto' | 'ya-registrado'

const ORDEN: Paso[] = ['nombre', 'correo', 'codigo', 'password', 'foto']

export function CrearCuenta() {
  const auth = useAuth()
  const navegar = useNavigate()
  const { mostrar } = useAvisos()

  const [paso, setPaso] = useState<Paso>('nombre')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tokenRegistro, setTokenRegistro] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const indice = ORDEN.indexOf(paso)
  const fuerza = fortalezaPassword(password)

  function avanzar(siguiente: Paso) {
    setError(null)
    setPaso(siguiente)
  }

  function retroceder() {
    setError(null)
    if (indice > 0) setPaso(ORDEN[indice - 1])
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (paso === 'nombre') {
      const limpio = nombre.trim()
      if (limpio.length < 2) {
        setError('Escribe tu nombre para continuar.')
        return
      }
      if (!/^[\p{L}\p{N}\p{M}\s._-]+$/u.test(limpio)) {
        setError('Usa solo letras, números, espacios, puntos o guiones.')
        return
      }
      avanzar('correo')
      return
    }

    if (paso === 'correo') {
      await pedirCodigo()
      return
    }

    if (paso === 'codigo') {
      await canjearCodigo()
      return
    }

    if (paso === 'password') {
      if (!fuerza.cumple) {
        setError(fuerza.mensaje)
        return
      }
      if (password !== confirmar) {
        setError('Las dos contraseñas no coinciden.')
        return
      }
      avanzar('foto')
      return
    }

    if (paso === 'foto') {
      await crearCuenta()
    }
  }

  async function pedirCodigo() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Ese correo no se ve válido. Revísalo.')
      return
    }
    setCargando(true)
    const res = await auth.solicitarCodigo(email.trim())
    setCargando(false)

    if (!res.ok) {
      // 409 → ese correo ya tiene cuenta. Vista dedicada con salidas claras,
      // en vez de un error rojo bajo un campo.
      if (res.status === 409) {
        setPaso('ya-registrado')
        return
      }
      setError(res.error ?? 'No pudimos enviar el código. Inténtalo de nuevo.')
      return
    }
    setCodigo('')
    avanzar('codigo')
  }

  async function canjearCodigo() {
    if (!/^\d{6}$/.test(codigo)) {
      setError('El código son 6 dígitos.')
      return
    }
    setCargando(true)
    const res = await auth.confirmarCodigo(email.trim(), codigo)
    setCargando(false)
    if (!res.ok || !res.tokenRegistro) {
      setError(res.error ?? 'El código no es correcto.')
      setCodigo('')
      return
    }
    setTokenRegistro(res.tokenRegistro)
    avanzar('password')
  }

  async function crearCuenta() {
    setCargando(true)
    const res = await auth.registrar({
      email: email.trim(),
      password,
      displayName: nombre.trim(),
      tokenRegistro,
      fotoUrl: foto ?? undefined,
    })
    setCargando(false)

    if (!res.ok) {
      if (res.status === 409) {
        setPaso('ya-registrado')
        return
      }
      setError(res.error ?? 'No pudimos crear la cuenta. Inténtalo de nuevo.')
      return
    }
    mostrar(`Bienvenido, ${nombre.trim()}`)
    navegar('/bienvenida')
  }

  // ── Vistas ──────────────────────────────────────────────────────────────

  if (paso === 'ya-registrado') {
    return (
      <Marco>
        <Encabezado
          titulo="Ese correo ya tiene cuenta"
          detalle={
            <>
              Ya existe una cuenta con{' '}
              <strong className="font-medium text-tinta">{email.trim()}</strong>. Entra
              con tu contraseña o recupérala si no la recuerdas.
            </>
          }
        />
        <div className="mt-7 space-y-2.5">
          <Boton ancho onClick={() => navegar('/entrar')}>
            Iniciar sesión
          </Boton>
          <Link
            to="/olvide-password"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-borde bg-superficie px-5 py-[11px] text-[15px] text-acento transition-colors hover:bg-elevada"
          >
            <KeyRound className="size-4" aria-hidden />
            Recuperar mi contraseña
          </Link>
          <Boton
            variante="fantasma"
            ancho
            onClick={() => {
              setEmail('')
              setPaso('correo')
            }}
          >
            Usar otro correo
          </Boton>
        </div>
      </Marco>
    )
  }

  return (
    <Marco>
      <Progreso indice={indice} total={ORDEN.length} />

      <form onSubmit={enviar} className="mt-6">
        {paso === 'nombre' && (
          <>
            <Encabezado
              titulo="¿Cómo te llamas?"
              detalle="Así te va a saludar la app y así firmamos los correos que te mandemos."
            />
            <Entrada
              autoFocus
              type="text"
              autoComplete="given-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              aria-label="Tu nombre"
              className="mt-6 py-3 text-[17px]"
            />
          </>
        )}

        {paso === 'correo' && (
          <>
            <Encabezado
              titulo="¿Cuál es tu correo?"
              detalle="Te mandamos un código para confirmarlo ahora mismo. Es con el que vas a entrar."
            />
            <Entrada
              autoFocus
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              aria-label="Tu correo"
              className="mt-6 py-3 text-[17px]"
            />
          </>
        )}

        {paso === 'codigo' && (
          <PasoCodigo
            email={email.trim()}
            codigo={codigo}
            onCodigo={setCodigo}
            onReenviar={async () => {
              const res = await auth.solicitarCodigo(email.trim())
              mostrar(
                res.ok
                  ? 'Te mandamos otro código. Revisa también la carpeta de spam.'
                  : (res.error ?? 'No se pudo reenviar'),
                res.ok ? 'exito' : 'error',
              )
            }}
            onCambiarCorreo={() => {
              setCodigo('')
              avanzar('correo')
            }}
          />
        )}

        {paso === 'password' && (
          <>
            <Encabezado
              titulo="Elige una contraseña"
              detalle="Mínimo 8 caracteres, con una mayúscula, una minúscula y un número."
            />
            <div className="relative mt-6">
              <Entrada
                autoFocus
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                aria-label="Tu contraseña"
                className="py-3 pr-11 text-[17px]"
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-tenue transition-colors hover:text-tinta"
              >
                {verPassword ? (
                  <EyeOff className="size-[18px]" />
                ) : (
                  <Eye className="size-[18px]" />
                )}
              </button>
            </div>
            <MedidorFortaleza fuerza={fuerza} />
            <Entrada
              type={verPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repítela"
              aria-label="Repite la contraseña"
              className="mt-3 py-3 text-[17px]"
            />
            {confirmar.length > 0 && confirmar !== password && (
              <p className="mt-1.5 text-[13px] text-rojo">
                Las dos contraseñas no coinciden.
              </p>
            )}
          </>
        )}

        {paso === 'foto' && (
          <PasoFoto nombre={nombre} foto={foto} onFoto={setFoto} onError={setError} />
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-rojo">
            {error}
          </p>
        )}

        {/* Los términos van donde de verdad se crea la cuenta, no cuatro
            pantallas antes de que exista nada que aceptar. */}
        {paso === 'foto' && (
          <p className="mt-5 text-[12px] leading-relaxed text-tenue">
            Al crear la cuenta aceptas el{' '}
            <Link
              to="/aviso-privacidad"
              target="_blank"
              rel="noopener"
              className="text-acento underline-offset-2 hover:underline"
            >
              aviso de privacidad
            </Link>
            .
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          {/* Desde el código no se retrocede con "Atrás": el correo ya se
              confirmó y volver atrás lo invalidaría sin decirlo. Ese paso
              tiene su propio "Usar otro correo". */}
          {indice > 0 && paso !== 'codigo' ? (
            <button
              type="button"
              onClick={retroceder}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] text-suave transition-colors hover:bg-elevada hover:text-tinta"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Atrás
            </button>
          ) : (
            <span />
          )}

          <Boton type="submit" disabled={cargando}>
            {cargando
              ? 'Espera…'
              : paso === 'correo'
                ? 'Enviarme el código'
                : paso === 'codigo'
                  ? 'Confirmar'
                  : paso === 'foto'
                    ? 'Crear cuenta'
                    : 'Siguiente'}
            {!cargando && paso !== 'codigo' && paso !== 'foto' && (
              <ArrowRight className="size-4" aria-hidden />
            )}
          </Boton>
        </div>
      </form>

      <p className="mt-8 text-center text-[14px] text-suave">
        ¿Ya tienes cuenta?{' '}
        <Link to="/entrar" className="text-acento hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Marco>
  )
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-fondo">
      <BarraPublica />
      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <div className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta sm:p-8">{children}</div>
      </div>
    </div>
  )
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[clamp(1.5rem,5vw,1.75rem)] leading-tight font-semibold tracking-[-0.03em] text-tinta">
        {titulo}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-suave">{detalle}</p>
    </div>
  )
}

/**
 * Cuántos pasos faltan. Con barra y no con "Paso 2 de 5": la proporción se lee
 * de un vistazo y no obliga a hacer la resta.
 */
function Progreso({ indice, total }: { indice: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="presentation">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clases(
            'h-1 flex-1 rounded-full transition-colors duration-300',
            i <= indice ? 'bg-acento' : 'bg-hundida',
          )}
          aria-hidden
        />
      ))}
    </div>
  )
}

function PasoCodigo({
  email,
  codigo,
  onCodigo,
  onReenviar,
  onCambiarCorreo,
}: {
  email: string
  codigo: string
  onCodigo: (c: string) => void
  onReenviar: () => Promise<void>
  onCambiarCorreo: () => void
}) {
  const [reenviando, setReenviando] = useState(false)
  const [espera, setEspera] = useState(45)

  // Cuenta atrás antes de dejar reenviar. Sin ella, la reacción natural a que
  // el correo tarde es picar "reenviar" cinco veces, y el endpoint está
  // limitado a 4 por minuto: el quinto intento devolvería un 429 que se lee
  // como "está roto".
  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  return (
    <>
      <Encabezado
        titulo="Revisa tu correo"
        detalle={
          <>
            Mandamos un código de 6 dígitos a{' '}
            <strong className="font-medium text-tinta">{email}</strong>. Tecléalo para
            confirmar que es tuyo.
          </>
        }
      />

      <input
        autoFocus
        type="text"
        inputMode="numeric"
        // Deja que iOS y Android ofrezcan el código sin salir del teclado.
        autoComplete="one-time-code"
        maxLength={6}
        value={codigo}
        onChange={(e) => onCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label="Código de 6 dígitos"
        placeholder="······"
        className="cifras mt-6 w-full rounded-campo border border-borde bg-elevada py-4 text-center text-[30px] font-semibold tracking-[0.35em] text-tinta placeholder:tracking-[0.35em] placeholder:text-tenue focus:border-acento focus:ring-3 focus:ring-acento/25 focus:outline-none"
      />

      <div className="mt-4 flex flex-col items-center gap-1.5">
        <button
          type="button"
          disabled={reenviando || espera > 0}
          onClick={async () => {
            setReenviando(true)
            await onReenviar()
            setReenviando(false)
            setEspera(45)
          }}
          className="text-[14px] text-acento transition-colors hover:underline disabled:text-tenue disabled:no-underline"
        >
          {reenviando
            ? 'Reenviando…'
            : espera > 0
              ? `Reenviar código en ${espera}s`
              : '¿No te llegó? Reenviar código'}
        </button>
        <button
          type="button"
          onClick={onCambiarCorreo}
          className="text-[13px] text-tenue transition-colors hover:text-tinta"
        >
          Usar otro correo
        </button>
      </div>
    </>
  )
}

function PasoFoto({
  nombre,
  foto,
  onFoto,
  onError,
}: {
  nombre: string
  foto: string | null
  onFoto: (f: string | null) => void
  onError: (e: string | null) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [procesando, setProcesando] = useState(false)

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    onError(null)
    setProcesando(true)
    const res = await prepararFotoPerfil(archivo)
    setProcesando(false)
    if (!res.ok || !res.dataUrl) {
      onError(MENSAJE_ERROR_FOTO[res.error ?? 'lectura'])
      return
    }
    onFoto(res.dataUrl)
  }

  return (
    <>
      <Encabezado
        titulo="Ponle una foto"
        detalle="Opcional. Si la saltas, usamos la inicial de tu nombre."
      />

      <div className="mt-7 flex flex-col items-center gap-4">
        <Avatar nombre={nombre || '?'} foto={foto} tamano="xl" />

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void elegir(e.target.files?.[0])
            // Permite volver a elegir el mismo archivo tras un error.
            e.target.value = ''
          }}
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Boton
            type="button"
            variante="secundario"
            disabled={procesando}
            onClick={() => entrada.current?.click()}
          >
            {foto ? (
              <RotateCcw className="size-4" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            {procesando ? 'Preparando…' : foto ? 'Cambiar foto' : 'Subir una foto'}
          </Boton>
          {foto && (
            <Boton type="button" variante="fantasma" onClick={() => onFoto(null)}>
              <Trash2 className="size-4" aria-hidden />
              Quitar
            </Boton>
          )}
        </div>
      </div>
    </>
  )
}
