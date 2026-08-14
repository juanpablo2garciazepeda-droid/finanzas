import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProveedorAuth, useAuth } from '@/estado/auth'
import { ProveedorI18n } from '@/estado/i18n'
import { Landing } from '@/paginas/Landing'
import { Login } from '@/paginas/Login'
import { CrearCuenta } from '@/paginas/CrearCuenta'
import { VerificarEmail } from '@/paginas/VerificarEmail'
import { OlvidePassword } from '@/paginas/OlvidePassword'
import { RestablecerPassword } from '@/paginas/RestablecerPassword'
import { AvisoPrivacidad } from '@/paginas/AvisoPrivacidad'
import { ProveedorAvisos } from '@/estado/avisos'
import { ProveedorFinanzas } from '@/estado/finanzas'
import { LimiteDeError } from '@/componentes/LimiteDeError'
import { MarcaGZ } from '@/componentes/Marca'
import { useRecordatorios } from '@/estado/recordatorios'
import { useAplicarApariencia } from '@/estado/tema'
import { Disposicion } from '@/componentes/Disposicion'
import { Tablero } from '@/paginas/Tablero'
import { Movimientos } from '@/paginas/Movimientos'
import { Presupuestos } from '@/paginas/Presupuestos'
import { Deudas } from '@/paginas/Deudas'
import { Metas } from '@/paginas/Metas'
import { Ajustes } from '@/paginas/Ajustes'
import { Recurrentes } from '@/paginas/Recurrentes'
import { Onboarding, debeMostrarOnboarding } from '@/paginas/Onboarding'

/**
 * `HashRouter` y no `BrowserRouter`: la app se sirve como archivos estáticos
 * y sin servidor que reescriba rutas, recargar en /deudas daría 404.
 *
 * Rutas públicas (sin sesión): login, olvidé, restablecer, verificar, aviso.
 * El resto requieren autenticación y viven dentro de `Disposicion`.
 *
 * `ProveedorI18n` y `ProveedorAvisos` envuelven las DOS ramas, no solo la
 * autenticada: el login, la verificación de correo y el restablecimiento
 * muestran avisos y texto traducido igual que el resto de la app. Tenerlos
 * solo dentro de la sesión dejaba la pantalla en negro para quien todavía no
 * había entrado, que es justo quien más necesita que la pantalla funcione.
 */
export default function App() {
  return (
    <LimiteDeError zona="app">
      <ProveedorAuth>
        <ProveedorI18n>
          <ProveedorAvisos>
            <PuertaAutenticacion />
          </ProveedorAvisos>
        </ProveedorI18n>
      </ProveedorAuth>
    </LimiteDeError>
  )
}

function PuertaAutenticacion() {
  const auth = useAuth()

  if (auth.iniciando) {
    return <PantallaCargando />
  }

  if (!auth.autenticado) {
    return (
      <HashRouter>
        <RutasPublicas />
      </HashRouter>
    )
  }

  return (
    <ProveedorFinanzas>
      <HashRouter>
        <Contenido />
      </HashRouter>
    </ProveedorFinanzas>
  )
}

/**
 * Arranque. Se ve el instante que tarda `/auth/me` en responder, así que en vez
 * de la palabra "Cargando…" suelta va la marca: el salto a la app se siente
 * como una continuación y no como un parpadeo.
 */
function PantallaCargando() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fondo">
      <MarcaGZ tamano={48} />
      <span className="size-5 animate-spin rounded-full border-2 border-borde border-t-acento" />
    </div>
  )
}

/**
 * Sin sesión, la raíz es la presentación y no el formulario de acceso: quien
 * llega por primera vez necesita saber qué es esto antes de que le pidan un
 * correo. Quien ya tiene cuenta entra por `/entrar`, y el navegador se acuerda
 * de esa dirección.
 */
function RutasPublicas() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/crear-cuenta" element={<CrearCuenta />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/restablecer-password" element={<RestablecerPassword />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      <Route path="/aviso-privacidad" element={<AvisoPrivacidad />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}

function Contenido() {
  useAplicarApariencia()
  useRecordatorios()

  return (
    <Disposicion>
      <Routes>
        <Route path="/" element={<Tablero />} />
        <Route path="/bienvenida" element={debeMostrarOnboarding() ? <Onboarding /> : <Tablero />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/presupuestos" element={<Presupuestos />} />
        <Route path="/deudas" element={<Deudas />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="/recurrentes" element={<Recurrentes />} />
        <Route path="/aviso-privacidad" element={<AvisoPrivacidad />} />
        <Route path="*" element={<Tablero />} />
      </Routes>
    </Disposicion>
  )
}
