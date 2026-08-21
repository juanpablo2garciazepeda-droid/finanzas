/**
 * Fechas y hitos de aviso, sin decoradores ni dependencias de Nest.
 *
 * Vive aparte del servicio para que se pueda probar: importar el servicio
 * arrastra `@Injectable`, `@Cron` y los repositorios de TypeORM, y aquí lo
 * único que hay que verificar es aritmética de calendario.
 */

/** Los tres momentos en que un pago merece un correo, y solo esos tres. */
export type Hito = 'previo' | 'hoy' | 'vencido';

const DIAS_POR_PERIODICIDAD: Record<string, number> = {
  semanal: 7,
  quincenal: 15,
  mensual: 30,
};

/**
 * Fechas como texto `YYYY-MM-DD` en hora local, igual que en el dominio del
 * front. Un `new Date(texto)` interpreta la cadena como UTC y en México
 * devuelve el día anterior: un pago del día 1 avisaría el 31.
 */
export function aFechaLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function aISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function hoyISO(): string {
  return aISO(new Date());
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = aFechaLocal(hasta).getTime() - aFechaLocal(desde).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Avanza una fecha de pago vencida hasta la siguiente ocurrencia futura.
 * Un pago mensual del día 5 sigue siendo del día 5 el mes que entra, así que
 * los mensuales avanzan por mes calendario y no por 30 días.
 *
 * Los meses se cuentan SIEMPRE desde la fecha original, no desde la anterior
 * ocurrencia. Iterando con `setMonth(+1)`, un pago del 31 de enero se
 * convierte en el 3 de marzo —febrero no tiene 31 y la fecha se desborda— y
 * a partir de ahí la fecha de corte se va corriendo sola mes a mes. Cuando el
 * día no existe en ese mes se usa el último: la deuda del 31 se cobra el 28
 * de febrero y vuelve al 31 en marzo, que es lo que hace el banco.
 */
export function siguienteOcurrencia(
  fechaLimite: string,
  periodicidad: string,
  hoy: string,
): string {
  if (periodicidad === 'unico') return fechaLimite;
  if (diasEntre(hoy, fechaLimite) >= 0) return fechaLimite;

  if (periodicidad === 'mensual') {
    const base = aFechaLocal(fechaLimite);
    const dia = base.getDate();
    for (let n = 1; n <= 600; n++) {
      const mes = new Date(base.getFullYear(), base.getMonth() + n, 1);
      const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
      mes.setDate(Math.min(dia, ultimo));
      const fecha = aISO(mes);
      if (diasEntre(hoy, fecha) >= 0) return fecha;
    }
    return fechaLimite;
  }

  const paso = DIAS_POR_PERIODICIDAD[periodicidad] ?? 30;
  let fecha = fechaLimite;
  let vueltas = 0;
  while (diasEntre(hoy, fecha) < 0 && vueltas < 600) {
    const d = aFechaLocal(fecha);
    d.setDate(d.getDate() + paso);
    fecha = aISO(d);
    vueltas++;
  }
  return fecha;
}

/**
 * En qué hito está un pago, o `null` si todavía no toca avisar.
 *
 * Tres correos por vencimiento y ni uno más: cuando faltan los días que la
 * persona configuró, el día que vence, y si se le pasó. Un resumen diario con
 * los mismos pagos entrena a la gente a archivarlo sin leerlo, y entonces el
 * aviso que sí importaba también se archiva.
 */
export function hitoDe(dias: number, ventana: number): Hito | null {
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  return dias <= ventana ? 'previo' : null;
}

export function comoTexto(dias: number): string {
  if (dias === 0) return 'vence hoy';
  if (dias > 0) return `vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  const pasados = Math.abs(dias);
  return `venció hace ${pasados} ${pasados === 1 ? 'día' : 'días'}`;
}

/** Los centavos solo si existen: $3.50 no puede leerse como $4. */
export function fmtMoneda(centavos: number, moneda: string, locale: string): string {
  const conDecimales = Math.round(centavos) % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: conDecimales ? 2 : 0,
  }).format(centavos / 100);
}
