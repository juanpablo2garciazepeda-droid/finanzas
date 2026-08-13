import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/space-grotesk'
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
