import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  // Navegación
  'tablero.titulo': 'Tablero',
  'movimientos.titulo': 'Movimientos',
  'presupuestos.titulo': 'Presupuestos',
  'deudas.titulo': 'Deudas',
  'metas.titulo': 'Metas',
  'ajustes.titulo': 'Ajustes',
  'recurrentes.titulo': 'Recurrentes',
  // Comunes
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
  'comun.volver': 'Volver',
  'comun.continuar': 'Continuar',
  'comun.enviar': 'Enviar',
  'comun.reenviar': 'Reenviar',
  'comun.sin_datos': 'Sin datos',
  'comun.fecha': 'Fecha',
  'comun.monto': 'Monto',
  'comun.categoria': 'Categoría',
  'comun.nota': 'Nota',
  'comun.opcional': 'Opcional',
  // Tablero
  'tablero.permitir': '¿Me lo puedo permitir?',
  'tablero.proximos_pagos': 'Próximos pagos',
  'tablero.ver_deudas': 'Ver deudas',
  'tablero.recomendaciones': 'Qué haría yo con esto',
  'tablero.flujo': 'Ingresos y egresos',
  'tablero.categorias': 'En qué se fue {periodo}',
  'tablero.evolucion': 'Deuda y ahorro',
  'tablero.salud': 'Salud financiera',
  'tablero.salud_puntos': 'Salud financiera · {puntos}/100',
  'tablero.gastado_ciclo': 'Gastado {ciclo}',
  'tablero.balance_ciclo': 'Balance {ciclo}',
  'tablero.deuda_total': 'Deuda total',
  'tablero.activas': '{n} activas',
  'tablero.ahorro_total': 'Ahorro total',
  'tablero.metas_en_curso': '{n} metas en curso',
  'tablero.entraron': '{monto} entraron',
  'tablero.sin_ingresos': 'Sin ingresos registrados aún',
  'tablero.estimados': '{monto} estimados, aún sin registrar',
  'tablero.falta_gastos': 'Falta lo más importante: tus gastos',
  'tablero.falta_detalle': 'Ya tengo tus deudas y tu ingreso. En cuanto registres gastos podré decirte con precisión cuánto te queda y en qué se te está yendo.',
  'tablero.primer_gasto': 'Registrar mi primer gasto',
  'tablero.bienvenida_titulo': 'Antes de gastar, pregúntale.',
  'tablero.bienvenida_detalle':
    'Finanzas GZ calcula cuánto te queda de verdad después de tus deudas y metas, y te dice si ese gasto cabe.',
  'tablero.bienvenida_p1_titulo': 'Registra un gasto',
  'tablero.bienvenida_p1_detalle': 'El botón + de abajo. Monto, categoría y listo.',
  'tablero.bienvenida_p2_titulo': 'Pon tus límites',
  'tablero.bienvenida_p2_detalle': 'Un presupuesto por categoría para tener contra qué medir.',
  'tablero.bienvenida_p3_titulo': 'Carga tus deudas y metas',
  'tablero.bienvenida_p3_detalle': 'Es lo que convierte el saldo en un margen real.',
  'tablero.bienvenida_empezar': 'Empieza con el botón {simbolo} de abajo a la derecha.',
  // Ajustes
  'ajustes.tu_cuenta': 'Tu cuenta',
  'ajustes.automatizacion': 'Automatización',
  'ajustes.recurrentes_desc': 'Gastos e ingresos recurrentes',
  'ajustes.tus_datos': 'Tus datos',
  'ajustes.exportar_desc': 'Exportar todos mis datos',
  'ajustes.importar_desc': 'Importar movimientos desde CSV',
  'ajustes.zona_peligrosa': 'Zona peligrosa',
  'ajustes.eliminar_desc': 'Eliminar mi cuenta',
  'ajustes.moneda_formato': 'Moneda y formato',
  'ajustes.apariencia': 'Apariencia',
  'ajustes.tu_dinero': 'Tu dinero',
  'ajustes.tu_ingreso': 'Tu ingreso',
  'ajustes.idioma': 'Idioma',
  'ajustes.idioma_es': 'Español',
  'ajustes.idioma_en': 'English',
  'ajustes.tema': 'Tema',
  'ajustes.color_acento': 'Color de acento',
  'ajustes.cada_cuanto': 'Cada cuánto cobras',
  'ajustes.moneda': 'Moneda',
  'ajustes.digest': 'Recibir resumen semanal por correo',
  'ajustes.digest_ayuda': 'Cada lunes con tus ingresos, gastos y deuda.',
  // Auth
  'auth.crear_cuenta': 'Crear cuenta',
  'auth.ya_tienes': '¿Ya tienes cuenta? Entra',
  'auth.no_tienes': '¿No tienes cuenta? Regístrate',
  'auth.email': 'Correo',
  'auth.password': 'Contraseña',
  'auth.nombre': 'Nombre',
  'auth.placeholder_email': 'tu@correo.com',
  'auth.placeholder_nombre': 'Cómo quieres que te diga la app',
  'auth.terminos': 'Acepto los términos y el aviso de privacidad',
  'auth.recordarme': 'Recordarme',
  'auth.olvide': '¿Olvidaste tu contraseña?',
}

const en: Diccionario = {
  // Navegación
  'tablero.titulo': 'Dashboard',
  'movimientos.titulo': 'Transactions',
  'presupuestos.titulo': 'Budgets',
  'deudas.titulo': 'Debts',
  'metas.titulo': 'Goals',
  'ajustes.titulo': 'Settings',
  'recurrentes.titulo': 'Recurring',
  // Comunes
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
  'comun.volver': 'Back',
  'comun.continuar': 'Continue',
  'comun.enviar': 'Send',
  'comun.reenviar': 'Resend',
  'comun.sin_datos': 'No data',
  'comun.fecha': 'Date',
  'comun.monto': 'Amount',
  'comun.categoria': 'Category',
  'comun.nota': 'Note',
  'comun.opcional': 'Optional',
  // Tablero
  'tablero.permitir': 'Can I afford it?',
  'tablero.proximos_pagos': 'Upcoming payments',
  'tablero.ver_deudas': 'See debts',
  'tablero.recomendaciones': "What I'd do with this",
  'tablero.flujo': 'Income and expenses',
  'tablero.categorias': 'Where {periodo} went',
  'tablero.evolucion': 'Debt and savings',
  'tablero.salud': 'Financial health',
  'tablero.salud_puntos': 'Financial health · {puntos}/100',
  'tablero.gastado_ciclo': 'Spent in {ciclo}',
  'tablero.balance_ciclo': 'Balance in {ciclo}',
  'tablero.deuda_total': 'Total debt',
  'tablero.activas': '{n} active',
  'tablero.ahorro_total': 'Total savings',
  'tablero.metas_en_curso': '{n} goals in progress',
  'tablero.entraron': '{monto} came in',
  'tablero.sin_ingresos': 'No income recorded yet',
  'tablero.estimados': '{monto} estimated, not yet recorded',
  'tablero.falta_gastos': "The most important thing is missing: your expenses",
  'tablero.falta_detalle':
    "I already have your debts and income. As soon as you record expenses I'll tell you exactly how much is left and where it's going.",
  'tablero.primer_gasto': 'Record my first expense',
  'tablero.bienvenida_titulo': 'Before spending, ask it.',
  'tablero.bienvenida_detalle':
    'Finanzas GZ calculates how much you really have left after your debts and goals, and tells you if that expense fits.',
  'tablero.bienvenida_p1_titulo': 'Record an expense',
  'tablero.bienvenida_p1_detalle': 'The + button below. Amount, category, done.',
  'tablero.bienvenida_p2_titulo': 'Set your limits',
  'tablero.bienvenida_p2_detalle': 'A budget per category to measure against.',
  'tablero.bienvenida_p3_titulo': 'Load your debts and goals',
  'tablero.bienvenida_p3_detalle': "That's what turns a balance into a real margin.",
  'tablero.bienvenida_empezar': 'Start with the {simbolo} button at the bottom right.',
  // Ajustes
  'ajustes.tu_cuenta': 'Your account',
  'ajustes.automatizacion': 'Automation',
  'ajustes.recurrentes_desc': 'Recurring expenses and income',
  'ajustes.tus_datos': 'Your data',
  'ajustes.exportar_desc': 'Export all my data',
  'ajustes.importar_desc': 'Import transactions from CSV',
  'ajustes.zona_peligrosa': 'Danger zone',
  'ajustes.eliminar_desc': 'Delete my account',
  'ajustes.moneda_formato': 'Currency and format',
  'ajustes.apariencia': 'Appearance',
  'ajustes.tu_dinero': 'Your money',
  'ajustes.tu_ingreso': 'Your income',
  'ajustes.idioma': 'Language',
  'ajustes.idioma_es': 'Spanish',
  'ajustes.idioma_en': 'English',
  'ajustes.tema': 'Theme',
  'ajustes.color_acento': 'Accent color',
  'ajustes.cada_cuanto': 'How often you get paid',
  'ajustes.moneda': 'Currency',
  'ajustes.digest': 'Receive weekly summary by email',
  'ajustes.digest_ayuda': 'Every Monday with your income, expenses and debt.',
  // Auth
  'auth.crear_cuenta': 'Create account',
  'auth.ya_tienes': 'Already have an account? Sign in',
  'auth.no_tienes': "Don't have an account? Sign up",
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.nombre': 'Name',
  'auth.placeholder_email': 'you@example.com',
  'auth.placeholder_nombre': 'How should the app call you',
  'auth.terminos': 'I accept the terms and the privacy notice',
  'auth.recordarme': 'Remember me',
  'auth.olvide': 'Forgot your password?',
}

const DICCIONARIOS: Record<Idioma, Diccionario> = { es, en }

interface I18nContexto {
  idioma: Idioma
  setIdioma: (i: Idioma) => Promise<void>
  t: (clave: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nContexto | null>(null)

const CLAVE_LOCAL = 'finanzas.idioma'

export function ProveedorI18n({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [idiomaLocal, setIdiomaLocal] = useState<Idioma>(() => {
    if (typeof window === 'undefined') return 'es'
    return (localStorage.getItem(CLAVE_LOCAL) as Idioma | null) ?? 'es'
  })
  // El estado local es la fuente de verdad para la UI. Si leyéramos
  // `usuario?.idioma ?? idiomaLocal`, el `??` se queda con el del server y
  // `setIdiomaLocal('en')` no pinta nada: el texto seguía en español hasta
  // que el server confirmara y el objeto `usuario` se re-hidratara, lo cual
  // no pasaba porque el PATCH /auth/perfil no actualiza el auth state. Por
  // eso "le pico a English y no hace nada".
  const idioma: Idioma = idiomaLocal

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

  // Sincroniza el estado local solo cuando el USUARIO cambia (login de
  // alguien con idioma distinto). Se ancla a `usuario.id` y no a
  // `usuario.idioma` para que un cambio local del propio usuario no se
  // reescriba con el valor viejo que aún tiene el objeto `usuario` en
  // memoria (el PATCH no lo refresca).
  const ultimoUsuarioSincronizado = useRef<string | null>(null)
  useEffect(() => {
    if (!usuario) {
      ultimoUsuarioSincronizado.current = null
      return
    }
    if (ultimoUsuarioSincronizado.current === usuario.id) return
    ultimoUsuarioSincronizado.current = usuario.id
    if (usuario.idioma && usuario.idioma !== idiomaLocal) {
      setIdiomaLocal(usuario.idioma as Idioma)
      try {
        localStorage.setItem(CLAVE_LOCAL, usuario.idioma)
      } catch {
        // sin localStorage no pasa nada grave
      }
    }
  }, [usuario, usuario?.id, usuario?.idioma, idiomaLocal])

  const t = useCallback(
    (clave: string, vars?: Record<string, string | number>): string => {
      const dic = DICCIONARIOS[idioma] ?? es
      let str = dic[clave] ?? es[clave] ?? clave
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
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
