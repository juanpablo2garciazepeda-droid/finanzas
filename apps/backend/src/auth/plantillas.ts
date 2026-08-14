/**
 * Plantillas de correo de Finanzas GZ.
 *
 * Decisiones que vienen de cómo funcionan los clientes de correo, no del gusto:
 *
 * · **Tablas, no flexbox.** Outlook sigue renderizando con el motor de Word.
 *   Un `<div style="display:flex">` se apila en desorden; una tabla de un ancho
 *   fijo se ve igual en los diez clientes que importan.
 *
 * · **Estilos en línea.** Gmail borra el `<style>` del `<head>` en la vista de
 *   conversación y en varias apps móviles. Todo lo que tenga que verse sí o sí
 *   va en el atributo `style` del propio elemento.
 *
 * · **Sin SVG y sin imágenes remotas.** Gmail elimina `<svg>`, y una imagen
 *   externa no se carga hasta que la persona pica "mostrar imágenes": un
 *   logotipo que empieza roto no es un logotipo. El símbolo se construye con
 *   un `<td>` de fondo sólido y esquinas redondeadas, que sí sobrevive.
 *
 * · **Ancho 600 px y una sola columna.** Es el ancho que cabe en el panel de
 *   lectura de Outlook de escritorio, y una columna no necesita media queries
 *   para verse bien en un teléfono.
 *
 * · **Siempre tema claro.** El soporte de `prefers-color-scheme` en correo es
 *   irregular: la mitad de los clientes invierten los colores por su cuenta y
 *   dejan texto oscuro sobre fondo oscuro. Se fija un esquema claro explícito
 *   y se declara `color-scheme: light` para pedirle a los que respetan el
 *   estándar que no lo toquen.
 */

const AZUL = '#0071E3';
const TINTA = '#1D1D1F';
const SUAVE = '#6E6E73';
const TENUE = '#86868B';
const FONDO = '#F5F5F7';
const BORDE = '#D2D2D7';

const TIPOGRAFIA =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export interface CorreoArmado {
  asunto: string;
  texto: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Esqueleto compartido: cabecera con la marca, tarjeta blanca con el
 * contenido y pie con la razón por la que llegó este correo.
 *
 * `preheader` es la línea que la bandeja de entrada muestra junto al asunto.
 * Si no se define, los clientes toman las primeras palabras del cuerpo, que
 * suelen ser "Hola Fulano," — un desperdicio del único renglón de contexto
 * que se ve antes de abrir.
 */
function envoltura({
  preheader,
  contenido,
  piePersonalizado,
}: {
  preheader: string;
  contenido: string;
  piePersonalizado?: string;
}): string {
  const pie =
    piePersonalizado ??
    'Recibiste este correo porque alguien lo pidió desde Finanzas GZ. Si no fuiste tú, puedes ignorarlo.';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Finanzas GZ</title>
</head>
<body style="margin:0;padding:0;background-color:${FONDO};color-scheme:light;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${FONDO};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <!-- Marca -->
        <tr>
          <td style="padding:0 0 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" height="40" align="center" valign="middle"
                    style="width:40px;height:40px;background-color:${AZUL};border-radius:10px;
                           font-family:${TIPOGRAFIA};font-size:15px;font-weight:700;
                           color:#FFFFFF;letter-spacing:-0.02em;">GZ</td>
                <td style="padding-left:10px;font-family:${TIPOGRAFIA};font-size:17px;
                           font-weight:600;color:${TINTA};letter-spacing:-0.02em;">Finanzas GZ</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tarjeta -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid ${BORDE};border-radius:16px;padding:32px;">
            ${contenido}
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:${TIPOGRAFIA};font-size:12px;
                     line-height:18px;color:${TENUE};">
            ${pie}<br>
            <span style="color:${TENUE};">Finanzas GZ · finanzasgz.com.mx</span>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function titulo(texto: string): string {
  return `<h1 style="margin:0 0 12px 0;font-family:${TIPOGRAFIA};font-size:24px;
    line-height:30px;font-weight:600;color:${TINTA};letter-spacing:-0.03em;">${texto}</h1>`;
}

function parrafo(texto: string, margenSuperior = 0): string {
  return `<p style="margin:${margenSuperior}px 0 0 0;font-family:${TIPOGRAFIA};font-size:15px;
    line-height:23px;color:${SUAVE};">${texto}</p>`;
}

function nota(texto: string): string {
  return `<p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid ${FONDO};
    font-family:${TIPOGRAFIA};font-size:13px;line-height:20px;color:${TENUE};">${texto}</p>`;
}

/**
 * Botón. Va como tabla con fondo sólido y no como `<a>` con padding: en
 * Outlook el relleno de un enlace se ignora y el botón queda del tamaño del
 * texto, sin área que picar.
 */
function boton(url: string, etiqueta: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
  <tr>
    <td align="center" style="background-color:${AZUL};border-radius:980px;">
      <a href="${url}" style="display:inline-block;padding:13px 28px;font-family:${TIPOGRAFIA};
         font-size:15px;font-weight:500;color:#FFFFFF;text-decoration:none;">${etiqueta}</a>
    </td>
  </tr>
</table>`;
}

/**
 * El código, que es lo único que la persona vino a buscar. Grande, espaciado
 * y seleccionable — nada de imagen: hay que poder copiarlo.
 */
function bloqueCodigo(codigo: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
  <tr>
    <td align="center" style="background-color:${FONDO};border-radius:12px;padding:24px 16px;">
      <div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
                  font-size:34px;line-height:40px;font-weight:600;color:${TINTA};
                  letter-spacing:0.32em;text-indent:0.32em;">${codigo}</div>
    </td>
  </tr>
</table>`;
}

/** Enlace de respaldo, en texto, para cuando el botón no se puede picar. */
function enlaceCrudo(url: string): string {
  return `<p style="margin:16px 0 0 0;font-family:${TIPOGRAFIA};font-size:12px;
    line-height:18px;color:${TENUE};word-break:break-all;">
    ¿No funciona el botón? Copia esta dirección en tu navegador:<br>
    <a href="${url}" style="color:${AZUL};text-decoration:none;">${url}</a>
  </p>`;
}

function saludo(nombre: string): string {
  const limpio = nombre.trim();
  return limpio ? `Hola ${escapeHtml(limpio)},` : 'Hola,';
}

// ── Correos concretos ───────────────────────────────────────────────────────

export function correoVerificacion(
  nombre: string,
  codigo: string,
  enlace: string,
): CorreoArmado {
  const asunto = `${codigo} es tu código de Finanzas GZ`;
  const texto = [
    saludo(nombre),
    '',
    `Tu código de verificación es: ${codigo}`,
    '',
    'Tecléalo en la pantalla donde te quedaste, o abre este enlace:',
    enlace,
    '',
    'El código vence en 30 minutos y solo sirve una vez.',
    'Si no creaste una cuenta en Finanzas GZ, ignora este mensaje.',
  ].join('\n');

  const html = envoltura({
    preheader: `Tu código es ${codigo}. Vence en 30 minutos.`,
    contenido: [
      titulo('Confirma tu correo'),
      parrafo(
        `${saludo(nombre)} ya casi terminas. Teclea este código en la pantalla donde te quedaste:`,
      ),
      bloqueCodigo(codigo),
      parrafo(
        '¿Abriste el correo en el mismo aparato donde te estás registrando? Entonces con el botón basta:',
        24,
      ),
      boton(enlace, 'Confirmar mi correo'),
      enlaceCrudo(enlace),
      nota(
        'El código vence en 30 minutos y solo sirve una vez. Si no creaste una cuenta en Finanzas GZ, no tienes que hacer nada: sin confirmar, la cuenta no se activa.',
      ),
    ].join('\n'),
  });

  return { asunto, texto, html };
}

export function correoBienvenida(nombre: string, enlaceApp: string): CorreoArmado {
  const asunto = 'Tu cuenta de Finanzas GZ está lista';
  const texto = [
    saludo(nombre),
    '',
    'Tu cuenta quedó lista. Para que la app te sirva desde el primer día:',
    '',
    '1. Pon tu ingreso y cada cuándo cobras (Ajustes → Tu ingreso).',
    '2. Declara cuánto tienes hoy en el banco.',
    '3. Registra tus deudas y metas.',
    '',
    'Con eso el tablero ya puede decirte cuánto puedes gastar hoy sin romper nada.',
    '',
    enlaceApp,
  ].join('\n');

  const paso = (n: number, t: string, d: string) =>
    `<tr>
      <td width="28" valign="top" style="padding:0 12px 14px 0;">
        <div style="width:24px;height:24px;background-color:#E8F2FD;border-radius:999px;
                    font-family:${TIPOGRAFIA};font-size:13px;font-weight:600;color:${AZUL};
                    text-align:center;line-height:24px;">${n}</div>
      </td>
      <td valign="top" style="padding:0 0 14px 0;font-family:${TIPOGRAFIA};">
        <div style="font-size:15px;font-weight:600;color:${TINTA};line-height:22px;">${t}</div>
        <div style="font-size:14px;color:${SUAVE};line-height:21px;">${d}</div>
      </td>
    </tr>`;

  const html = envoltura({
    preheader: 'Tres pasos para que el tablero empiece a servirte.',
    contenido: [
      titulo('Ya estás dentro'),
      parrafo(
        `${saludo(nombre)} tu cuenta quedó lista. La app responde una sola pregunta —<strong style="color:${TINTA};">¿puedo gastar esto?</strong>— y para responderla bien necesita tres datos:`,
      ),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
        ${paso(1, 'Tu ingreso y tu ciclo de cobro', 'Si cobras por quincena, el margen se calcula por quincena.')}
        ${paso(2, 'Cuánto tienes hoy', 'Una sola vez. De ahí en adelante la app lleva la cuenta.')}
        ${paso(3, 'Tus deudas y metas', 'Es lo que convierte un saldo en un margen real.')}
      </table>`,
      boton(enlaceApp, 'Abrir Finanzas GZ'),
      nota(
        'Tus datos son tuyos: puedes exportarlos en CSV o JSON, y borrar la cuenta entera cuando quieras desde Ajustes.',
      ),
    ].join('\n'),
    piePersonalizado:
      'Recibiste este correo porque acabas de crear una cuenta en Finanzas GZ.',
  });

  return { asunto, texto, html };
}

export function correoReset(nombre: string, enlace: string): CorreoArmado {
  const asunto = 'Restablece tu contraseña de Finanzas GZ';
  const texto = [
    saludo(nombre),
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
    'Si fuiste tú, entra a este enlace (vence en 30 minutos):',
    enlace,
    '',
    'Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.',
  ].join('\n');

  const html = envoltura({
    preheader: 'Enlace para elegir una contraseña nueva. Vence en 30 minutos.',
    contenido: [
      titulo('Restablece tu contraseña'),
      parrafo(
        `${saludo(nombre)} recibimos una solicitud para cambiar la contraseña de tu cuenta. Si fuiste tú, elige una nueva aquí:`,
      ),
      boton(enlace, 'Elegir contraseña nueva'),
      enlaceCrudo(enlace),
      nota(
        'El enlace vence en 30 minutos. <strong style="color:' +
          SUAVE +
          '">Si no fuiste tú, no tienes que hacer nada</strong>: tu contraseña sigue igual y nadie puede cambiarla sin este correo. Al usarlo, se cerrará la sesión en todos tus dispositivos.',
      ),
    ].join('\n'),
    piePersonalizado:
      'Recibiste este correo porque se pidió restablecer la contraseña de esta cuenta.',
  });

  return { asunto, texto, html };
}

export function correoCambioCorreo(
  nombre: string,
  nuevoEmail: string,
  enlace: string,
): CorreoArmado {
  const asunto = 'Confirma tu nuevo correo en Finanzas GZ';
  const texto = [
    saludo(nombre),
    '',
    `Recibimos una solicitud para cambiar el correo de tu cuenta a ${nuevoEmail}.`,
    'Si fuiste tú, confirma aquí (vence en 30 minutos):',
    enlace,
    '',
    'Si no fuiste tú, ignora este mensaje: tu correo no cambia.',
  ].join('\n');

  const html = envoltura({
    preheader: `Confirma el cambio a ${nuevoEmail}.`,
    contenido: [
      titulo('Confirma tu nuevo correo'),
      parrafo(
        `${saludo(nombre)} pediste cambiar el correo de tu cuenta a <strong style="color:${TINTA};">${escapeHtml(nuevoEmail)}</strong>. Confírmalo para que el cambio surta efecto:`,
      ),
      boton(enlace, 'Confirmar el cambio'),
      enlaceCrudo(enlace),
      nota(
        'Hasta que piques el botón, tu correo actual sigue siendo el válido. Si no pediste este cambio, ignora el mensaje.',
      ),
    ].join('\n'),
    piePersonalizado:
      'Recibiste este correo porque se pidió usarlo como nuevo correo de una cuenta de Finanzas GZ.',
  });

  return { asunto, texto, html };
}

// ── Resumen semanal ─────────────────────────────────────────────────────────

export interface FilaResumen {
  etiqueta: string;
  valor: string;
  /** Tono del valor: neutro, bueno o de alerta. */
  tono?: 'neutro' | 'bueno' | 'alerta';
}

export function correoDigest({
  nombre,
  periodo,
  filas,
  mensaje,
  enlaceApp,
}: {
  nombre: string;
  periodo: string;
  filas: FilaResumen[];
  mensaje: string;
  enlaceApp: string;
}): CorreoArmado {
  const asunto = `Tu semana en Finanzas GZ · ${periodo}`;
  const texto = [
    saludo(nombre),
    '',
    `Resumen de ${periodo}:`,
    ...filas.map((f) => `· ${f.etiqueta}: ${f.valor}`),
    '',
    mensaje,
    '',
    enlaceApp,
  ].join('\n');

  const color = (tono: FilaResumen['tono']) =>
    tono === 'bueno' ? '#248A3D' : tono === 'alerta' ? '#D70015' : TINTA;

  const cuerpoFilas = filas
    .map(
      (f) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${FONDO};font-family:${TIPOGRAFIA};
                   font-size:15px;color:${SUAVE};">${escapeHtml(f.etiqueta)}</td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${FONDO};
                   font-family:${TIPOGRAFIA};font-size:15px;font-weight:600;
                   color:${color(f.tono)};white-space:nowrap;">${escapeHtml(f.valor)}</td>
      </tr>`,
    )
    .join('\n');

  const html = envoltura({
    preheader: mensaje,
    contenido: [
      titulo('Tu semana en números'),
      parrafo(`${saludo(nombre)} esto es lo que pasó en ${escapeHtml(periodo)}.`),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">${cuerpoFilas}</table>`,
      parrafo(escapeHtml(mensaje), 24),
      boton(enlaceApp, 'Ver mi tablero'),
      nota(
        'Puedes dejar de recibir este resumen cuando quieras desde Ajustes → Notificaciones.',
      ),
    ].join('\n'),
    piePersonalizado:
      'Recibiste este correo porque tienes activado el resumen semanal en Finanzas GZ.',
  });

  return { asunto, texto, html };
}
