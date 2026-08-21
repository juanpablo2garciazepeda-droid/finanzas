/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // El backend no monta su propio runner: sus piezas puras —la aritmética
    // de calendario de los recordatorios— se prueban desde aquí. Los archivos
    // con decoradores de Nest no se importan nunca desde una prueba.
    include: ['src/**/*.test.ts', 'apps/backend/src/**/*.test.ts'],
  },
})
