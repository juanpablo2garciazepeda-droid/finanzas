import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/api/cliente'
import { useAuth } from './auth'
import type { Idioma } from '@/dominio/tipos'

/**
 * i18n minimalista: diccionario plano por idioma y un hook `t()` que
 * devuelve la cadena. Si la clave no existe, devuelve la versión en
 * español como fallback (nunca undefined).
 *
 * El idioma se persiste en el backend (`users.idioma`) y se carga al
 * hidratar el usuario. Si no hay usuario, usa localStorage.
 */

type Diccionario = Record<string, string>

const es: Diccionario = {
  'tablero.titulo': 'Tablero',
  'movimientos.titulo': 'Movimientos',
  'presupuestos.titulo': 'Presupuestos',
  'deudas.titulo': 'Deudas',
  'metas.titulo': 'Metas',
  'ajustes.titulo': 'Ajustes',
  'recurrentes.titulo': 'Recurrentes',
  'comun.cargando': 'Cargando…',
  'comun.guardar': 'Guardar',
  'comun.cancelar': 'Cancelar',
  'comun.eliminar': 'Eliminar',
  'comun.aceptar': 'Aceptar',
  'comun.cerrar': 'Cerrar',
  'comun.salir': 'Salir',
  'comun.entrar': 'Entrar',
  'comun.buscar': 'Buscar',
  'comun.configurar': 'Configurar',
  'auth.crear_cuenta': 'Crear cuenta',
  'auth.ya_tienes': '¿Ya tienes cuenta? Entra',
  'auth.no_tienes': '¿No tienes cuenta? Regístrate',
  'ajustes.idioma': 'Idioma',
  'ajustes.idioma_es': 'Español',
  'ajustes.idioma_en': 'English',
  'ajustes.digest': 'Recibir resumen semanal por correo',
  'ajustes.digest_ayuda': 'Cada lunes con tus ingresos, gastos y deuda.',
  'auth.email': 'Correo',
  'auth.password': 'Contraseña',
  'auth.nombre': 'Nombre',
  'auth.placeholder_email': 'tu@correo.com',
  'auth.placeholder_nombre': 'Cómo quieres que te diga la app',
  'auth.terminos': 'Acepto los términos y el aviso de privacidad',
  'auth.recordarme': 'Recordarme',
  'auth.olvide': '¿Olvidaste tu contraseña?',
  'common.sin_datos': 'Sin datos',
  'common.fecha': 'Fecha',
  'common.monto': 'Monto',
  'common.categoria': 'Categoría',
}

const en: Diccionario = {
  'tablero.titulo': 'Dashboard',
  'movimientos.titulo': 'Transactions',
  'presupuestos.titulo': 'Budgets',
  'deudas.titulo': 'Debts',
  'metas.titulo': 'Goals',
  'ajustes.titulo': 'Settings',
  'recurrentes.titulo': 'Recurring',
  'comun.cargando': 'Loading…',
  'comun.guardar': 'Save',
  'comun.cancelar': 'Cancel',
  'comun.eliminar': 'Delete',
  'comun.aceptar': 'OK',
  'comun.cerrar': 'Close',
  'comun.salir': 'Log out',
  'comun.entrar': 'Sign in',
  'comun.buscar': 'Search',
  'comun.configurar': 'Set up',
  'auth.crear_cuenta': 'Create account',
  'auth.ya_tienes': 'Already have an account? Sign in',
  'auth.no_tienes': "Don't have an account? Sign up",
  'ajustes.idioma': 'Language',
  'ajustes.idioma_es': 'Spanish',
  'ajustes.idioma_en': 'English',
  'ajustes.digest': 'Receive weekly summary by email',
  'ajustes.digest_ayuda': 'Every Monday with your income, expenses and debt.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.nombre': 'Name',
  'auth.placeholder_email': 'you@example.com',
  'auth.placeholder_nombre': 'How should the app call you',
  'auth.terminos': 'I accept the terms and the privacy notice',
  'auth.recordarme': 'Remember me',
  'auth.olvide': 'Forgot your password?',
  'common.sin_datos': 'No data',
  'common.fecha': 'Date',
  'common.monto': 'Amount',
  'common.categoria': 'Category',
}

const DICCIONARIOS: Record<Idioma, Diccionario> = { es, en }

interface I18nContexto {
  idioma: Idioma
  setIdioma: (i: Idioma) => Promise<void>
  t: (clave: string) => string
}

const Ctx = createContext<I18nContexto | null>(null)

const CLAVE_LOCAL = 'finanzas.idioma'

export function ProveedorI18n({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [idiomaLocal, setIdiomaLocal] = useState<Idioma>(() => {
    if (typeof window === 'undefined') return 'es'
    return (localStorage.getItem(CLAVE_LOCAL) as Idioma | null) ?? 'es'
  })
  const idioma: Idioma = (usuario?.idioma as Idioma | undefined) ?? idiomaLocal

  const setIdioma = useCallback(
    async (nuevo: Idioma) => {
      setIdiomaLocal(nuevo)
      if (typeof window !== 'undefined') {
        localStorage.setItem(CLAVE_LOCAL, nuevo)
      }
      // Si hay sesión, persistir en el backend
      if (usuario) {
        await api.patch('/auth/perfil', { idioma: nuevo })
      }
    },
    [usuario],
  )

  // Sincronizar localStorage cuando el usuario cambia (login de alguien con
  // idioma distinto).
  useEffect(() => {
    if (usuario?.idioma) {
      localStorage.setItem(CLAVE_LOCAL, usuario.idioma)
    }
  }, [usuario?.idioma])

  const t = useCallback(
    (clave: string): string => {
      const dic = DICCIONARIOS[idioma] ?? es
      return dic[clave] ?? es[clave] ?? clave
    },
    [idioma],
  )

  const valor = useMemo<I18nContexto>(() => ({ idioma, setIdioma, t }), [idioma, setIdioma, t])
  return <Ctx value={valor}>{children}</Ctx>
}

export function useI18n(): I18nContexto {
  const v = use(Ctx)
  if (!v) throw new Error('useI18n necesita estar dentro de ProveedorI18n')
  return v
}

/** Hook de azúcar para t(). */
export function useT() {
  return useI18n().t
}
