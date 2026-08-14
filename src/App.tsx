import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProveedorAuth, useAuth } from '@/estado/auth'
import { ProveedorI18n } from '@/estado/i18n'
import { Login } from '@/paginas/Login'
import { VerificarEmail } from '@/paginas/VerificarEmail'
import { OlvidePassword } from '@/paginas/OlvidePassword'
import { RestablecerPassword } from '@/paginas/RestablecerPassword'
import { AvisoPrivacidad } from '@/paginas/AvisoPrivacidad'
import { ProveedorAvisos } from '@/estado/avisos'
import { ProveedorFinanzas } from '@/estado/finanzas'
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
 */
export default function App() {
  return (
    <ProveedorAuth>
      <PuertaAutenticacion />
    </ProveedorAuth>
  )
}

function PuertaAutenticacion() {
  const auth = useAuth()

  if (auth.iniciando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-fondo">
        <p className="text-suave">Cargando…</p>
      </div>
    )
  }

  if (!auth.autenticado) {
    return (
      <HashRouter>
        <RutasPublicas />
      </HashRouter>
    )
  }

  return (
    <ProveedorI18n>
      <ProveedorAvisos>
        <ProveedorFinanzas>
          <HashRouter>
            <Contenido />
          </HashRouter>
        </ProveedorFinanzas>
      </ProveedorAvisos>
    </ProveedorI18n>
  )
}

function RutasPublicas() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/restablecer-password" element={<RestablecerPassword />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      <Route path="/aviso-privacidad" element={<AvisoPrivacidad />} />
      <Route path="*" element={<Login />} />
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
