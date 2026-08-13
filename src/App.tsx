import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { hayPin, sesionAbierta, vigilarSegundoPlano } from '@/estado/bloqueo'
import { PantallaBloqueo } from '@/componentes/PantallaBloqueo'
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
  // El candado va por fuera de los datos: si está echado, la app ni siquiera
  // monta el proveedor que lee IndexedDB.
  const [bloqueada, setBloqueada] = useState(() => hayPin() && !sesionAbierta())

  useEffect(() => vigilarSegundoPlano(() => setBloqueada(true)), [])

  if (bloqueada) return <PantallaBloqueo onEntrar={() => setBloqueada(false)} />

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
