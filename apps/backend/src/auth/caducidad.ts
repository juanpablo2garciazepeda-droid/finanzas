/**
 * Cuánto viven los secretos que Finanzas GZ manda por correo.
 *
 * Viven aquí y no en `auth.service.ts` porque las plantillas necesitan el
 * mismo número para escribirlo en el cuerpo del mensaje, y `plantillas.ts` no
 * puede importar del servicio sin cerrar un ciclo. Antes el texto "30 minutos"
 * estaba escrito a mano en doce sitios: bastaba cambiar la constante para que
 * todos los correos empezaran a mentir sobre su propia caducidad.
 *
 * Diez minutos y no treinta porque estos dos secretos **viajan por correo**:
 * se quedan en una bandeja, se reenvían, se leen en un aparato prestado.
 * Acortarlos es seguridad real y no cuesta nada, porque las dos pantallas
 * tienen botón de reenviar a un clic.
 *
 * El pase que devuelve `/auth/confirmar-codigo-registro` NO sigue esta regla y
 * se queda en 30 minutos a propósito: ese no sale nunca del navegador de quien
 * ya demostró que controla el buzón, así que acortarlo no compra seguridad. Sí
 * costaría altas — cubre los pasos de contraseña y foto, y al vencer el código
 * ya quedó marcado como usado, o sea que hay que volver a empezar.
 */

export const MINUTOS_VERIFICACION = 10;
export const MINUTOS_RESET = 10;

export const EXPIRACION_VERIFICACION_MS = MINUTOS_VERIFICACION * 60 * 1000;
export const EXPIRACION_RESET_MS = MINUTOS_RESET * 60 * 1000;
