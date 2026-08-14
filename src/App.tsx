import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProveedorAuth, useAuth } from '@/estado/auth'
import { Login } from '@/paginas/Login'
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

/**
 * `HashRouter` y no `BrowserRouter`: la app se sirve como archivos estáticos y
 * sin servidor que reescriba rutas, recargar en /deudas daría 404.
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

  if (!auth.autenticado) return <Login />

  return (
    <ProveedorAvisos>
      <ProveedorFinanzas>
        <HashRouter>
          <Contenido />
        </HashRouter>
      </ProveedorFinanzas>
    </ProveedorAvisos>
  )
}

function Contenido() {
  useAplicarApariencia()
  useRecordatorios()

  return (
    <Disposicion>
      <Routes>
        <Route path="/" element={<Tablero />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/presupuestos" element={<Presupuestos />} />
        <Route path="/deudas" element={<Deudas />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Tablero />} />
      </Routes>
    </Disposicion>
  )
}
