import { Link } from 'react-router-dom'
import { ChevronLeft, Shield } from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Basicos'

/**
 * Aviso de Privacidad conforme a la LFPDPPP (México).
 *
 * Es texto legal, no UI de producto: se mantiene corto, claro, en
 * lenguaje de a deveras, y se enlaza desde el checkbox de "términos y
 * privacidad" del registro.
 */
export function AvisoPrivacidad() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[13px] text-suave hover:text-tinta"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver
        </Link>
      </div>
      <Tarjeta>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-acento/10">
            <Shield className="size-4 text-acento" aria-hidden />
          </span>
          <h1 className="font-display text-[20px] font-semibold text-tinta">
            Aviso de Privacidad
          </h1>
        </div>
        <p className="text-[12px] text-tenue">
          Última actualización: agosto 2026
        </p>

        <section className="mt-4 space-y-3 text-[14px] text-suave">
          <p>
            <strong className="text-tinta">Responsable.</strong> Juan Pablo
            García Zepeda (&ldquo;Finanzas GZ&rdquo;), con domicilio en
            Colima, México, es responsable del tratamiento de tus datos
            personales.
          </p>

          <p>
            <strong className="text-tinta">Datos que recabamos.</strong>{' '}
            Correo electrónico, nombre para mostrar, contraseña (hasheada
            con bcrypt, nunca en claro) y los datos financieros que tú
            mismo registras: movimientos, categorías, deudas, metas y
            ajustes de la app.
          </p>

          <p>
            <strong className="text-tinta">Finalidades.</strong> Proveerte el
            servicio de registro financiero personal, autenticarte,
            mantener tu sesión abierta, enviarte correos de verificación y
            recuperación de contraseña, y atender soporte.
          </p>

          <p>
            <strong className="text-tinta">No vendemos ni compartimos</strong>{' '}
            tus datos con terceros. No usamos tus datos para publicidad.
          </p>

          <p>
            <strong className="text-tinta">Transferencias.</strong>{' '}
            Únicamente tu proveedor de correo (para enviarte
            verificaciones) y nuestro proveedor de hosting (para servir la
            base de datos). Ambos se obligan a no usar los datos para fines
            propios.
          </p>

          <p>
            <strong className="text-tinta">Seguridad.</strong> HTTPS
            obligatorio, contraseñas con bcrypt rounds 12, JWT firmados
            con expiración de 30 días, base de datos con backups
            periódicos, y validación contra inyecciones SQL en todos los
            endpoints.
          </p>

          <p>
            <strong className="text-tinta">Tus derechos (ARCO).</strong>{' '}
            Puedes acceder, rectificar, cancelar u oponerte al tratamiento
            de tus datos desde la sección &ldquo;Tu cuenta&rdquo; de Ajustes
            (botón &ldquo;Eliminar cuenta&rdquo;). Para cualquier otra
            solicitud, escribe a <em>privacidad@finanzasgz.com.mx</em>.
          </p>

          <p>
            <strong className="text-tinta">Cambios a este aviso.</strong>{' '}
            Te avisaremos por correo y dentro de la app antes de cualquier
            cambio material. El uso continuado del servicio después del
            aviso se entiende como aceptación.
          </p>

          <p>
            <strong className="text-tinta">Marco legal.</strong> Este aviso
            cumple con la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares (LFPDPPP) y su Reglamento.
          </p>
        </section>
      </Tarjeta>
    </div>
  )
}
