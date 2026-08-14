import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Solo Inter Tight: es la que nombra `--font-display` en index.css como
// respaldo para los aparatos sin SF Pro. Space Grotesk se descargaba entera
// —una fuente variable completa— sin que ninguna regla la mencionara.
import '@fontsource-variable/inter-tight'
import './index.css'
import App from './App'
import { aplicarAparienciaGuardada } from './estado/tema'

aplicarAparienciaGuardada()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
