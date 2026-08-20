import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Estado global del modal "Editar perfil".
 *
 * Varios puntos de la app pueden querer abrirlo:
 *  - el botón "Editar perfil" en Ajustes
 *  - el item "Editar perfil" del popover del avatar en el sidebar
 *  - (futuro) el avatar del header en mobile
 *
 * En lugar de pasar handlers por props o duplicar estado, este context
 * expone un simple `abrir()` / `cerrar()` que cualquier componente puede
 * llamar. El modal se renderiza una sola vez en `Disposicion`.
 */
type Ctx = {
  abierto: boolean
  abrir: () => void
  cerrar: () => void
}

const EditorPerfilContext = createContext<Ctx | null>(null)

export function EditorPerfilProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <EditorPerfilContext.Provider
      value={{
        abierto,
        abrir: () => setAbierto(true),
        cerrar: () => setAbierto(false),
      }}
    >
      {children}
    </EditorPerfilContext.Provider>
  )
}

export function useEditorPerfil(): Ctx {
  const ctx = useContext(EditorPerfilContext)
  if (!ctx) {
    throw new Error('useEditorPerfil debe usarse dentro de EditorPerfilProvider')
  }
  return ctx
}
