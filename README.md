# Juanpa Finanzas

App web de control financiero personal: gastos, presupuestos, deudas, metas de ahorro y un
semáforo que responde a la única pregunta que importa antes de pagar — **¿puedo gastar esto?**

Todo vive en el navegador. No hay servidor, no hay cuenta, no sale un solo dato del dispositivo.

## Cómo correrla

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 129 pruebas del dominio
npm run build    # bundle de producción en dist/
```

En el primer arranque la app está vacía. Hay un botón para cargar cuatro meses de datos de
ejemplo con una deuda cara, una categoría rebasada y una meta que no llega a tiempo, para ver
el semáforo y las recomendaciones trabajando.

## La idea

Un balance de fin de mes no sirve para decidir en la caja del súper. Lo que sirve es el
**margen libre**:

```
margen libre = (ingresos del ciclo, o la parte de tu sueldo que le toca)
             − egresos del ciclo
             − pagos de deuda que vencen antes de que cierre
             − la parte del aporte a metas que toca a este ciclo
```

Y de ahí sale la cifra que preside el tablero: **cuánto puedes gastar hoy**, que es
`margen libre ÷ días que faltan para tu próximo corte`.

El semáforo evalúa el gasto candidato contra ese margen y contra el presupuesto de su
categoría, y devuelve verde / ámbar / rojo **con las razones concretas**: un rojo sin
explicación no cambia el comportamiento de nadie.

## Estructura

```
src/
  dominio/        Lógica pura. Sin React, sin base de datos, sin DOM.
    tipos.ts          Modelo de datos
    dinero.ts         Centavos enteros y formateo
    fechas.ts         Periodos YYYY-MM y fechas YYYY-MM-DD en hora local
    categorias.ts     Orden del selector por frecuencia de uso
    ciclos.ts         Ventana de cobro: mes, quincena o semana
    presupuestos.ts   Gasto contra límite, comparativa mes a mes
    deudas.ts         Amortización, vencimientos, método avalancha
    metas.ts          Proyección de llegada y aporte necesario
    alertas.ts        El semáforo y el cálculo del margen  ← el corazón
    salud.ts          Puntaje 0-100 y series históricas
    recomendaciones.ts  Reglas que producen consejos accionables
    *.test.ts         129 pruebas sobre todo lo anterior

  datos/          Persistencia. El único lugar que toca IndexedDB.
    db.ts             Esquema Dexie (v4)
    repositorio.ts    Todas las escrituras; recalcula saldos derivados
    demo.ts           Datos de ejemplo
    categoriasIniciales.ts

  estado/         Puente entre datos y UI.
    finanzas.tsx      Contexto con useLiveQuery: la UI reacciona sola
    avisos.tsx        Toasts con deshacer
    recordatorios.ts  Notificaciones de vencimientos
    bloqueo.ts        PIN de pantalla (hash SHA-256 + sal)

  componentes/    UI reutilizable.
    ui/               Tarjeta, Botón, Campo, Barra, Insignia, Modal, Icono
    ui/CampoFecha.tsx Calendario propio: el nativo no acepta estilos
    MedidorMargen.tsx El arco del semáforo
    FormularioMovimiento.tsx  Registro rápido con semáforo en vivo
    Disposicion.tsx   Nav inferior en móvil, barra lateral en escritorio

  graficas/       Recharts + paleta validada
  paginas/        Tablero, Movimientos, Presupuestos, Deudas, Metas, Ajustes
  exportar/       CSV y PDF
```

## Decisiones que conviene conocer

**Los montos son enteros de centavos.** `$1,234.56` se guarda como `123456`. Sumar floats y
compararlos contra un presupuesto produce diferencias de un centavo que en una app de dinero se
leen como bugs.

**Las fechas son texto `YYYY-MM-DD`, nunca `Date`.** Son indexables, ordenan alfabéticamente
igual que cronológicamente, y evitan que un gasto del 31 a las 22:00 se registre en el mes
siguiente por zona horaria. `fechas.ts` nunca pasa una fecha ISO a `new Date(texto)`.

**El dominio no sabe que existe React ni IndexedDB.** Por eso el motor de alertas se prueba sin
montar nada, y migrar a un backend (Supabase, Postgres) toca solo `datos/`.

**Los saldos derivados están materializados.** `deuda.saldoActual` y `meta.montoActual` se
recalculan desde cero dentro de la misma transacción que los provoca, en vez de sumar todo el
historial en cada render. Si algo se desincroniza, se reconstruyen desde los pagos y aportes.

**El aspecto viene de apple.com/mx, medido y no imitado de memoria.** Los tokens salen de
`getComputedStyle` sobre el sitio: fondo `#F5F5F7`, tarjetas blancas de radio 18px, texto
`#1D1D1F`, secundario `#86868B`, azul `#0071E3`, botones en píldora y tipografía del sistema
(SF Pro en dispositivos Apple, Inter Tight en el resto). Todo vive en `src/index.css`.

**La paleta de gráficas está validada, no elegida a ojo.** Los ocho colores de serie pasan las
cinco comprobaciones sobre las dos superficies claras `#FFFFFF` y `#F5F5F7`: banda de luminosidad
OKLCH 0.43–0.77, croma mínimo, separación para daltonismo protan/deutan/tritan, separación en
visión normal y contraste ≥ 3:1. Están en `src/graficas/paleta.ts`. **No cambies un hex sin
volver a validarlo.** El selector de color de categorías ofrece esos mismos ocho y no doce: más
de ocho tonos categóricos no logran separarse bajo daltonismo, así que ofrecer doce sería fingir
una precisión que no existe. El azul de la interfaz queda fuera a propósito: su trabajo es marcar
controles activos, no identificar series.

**Los formularios se montan al abrirse.** Uno que sobrevive escondido conserva lo que se capturó
la vez anterior y lo muestra al volver a abrirlo. Por eso las páginas renderizan
`{abierto && <Formulario/>}` en vez de pasar una prop `abierto`.

**El ciclo de cobro manda, no el mes.** Quien cobra por quincena decide con lo que le queda
hasta el día 15; decirle cuánto le sobra "en el mes" no le sirve en la caja del súper. Se
configura en Ajustes y el semáforo entero se recalcula sobre esa ventana. Los presupuestos, las
gráficas y el puntaje de salud siguen siendo mensuales a propósito: ahí la pregunta es "¿cómo me
fue?", no "¿puedo gastar?".

**El dinero estimado nunca se muestra como dinero real.** Mientras no haya un ingreso registrado
en el ciclo, el margen se calcula con una estimación del sueldo: eso mantiene la app útil el día 1.
Pero la tarjeta dice "estimados, aún sin registrar" en vez de "entraron", y el tablero pregunta
"¿Ya cobraste?" con un botón que convierte la estimación en un movimiento de verdad. Confundir
las dos cosas es lo que hace que los números parezcan no cuadrar cuando borras un ingreso y la
cifra no se mueve.

**El puntaje de salud exige al menos dos componentes con datos.** Con uno solo, el promedio es ese
componente: alguien sin deudas ni movimientos sacaría 100 y se le estaría diciendo que su salud es
sólida cuando no se sabe nada de ella.

**El PIN es un candado de pantalla, no autenticación.** No hay servidor contra el que validar y los
datos siguen en IndexedDB sin cifrar; alguien con acceso al dispositivo y ganas puede leerlos desde
las herramientas del navegador. Sirve para que quien tome tu teléfono no vea tus finanzas, y la
pantalla de Ajustes lo dice con estas mismas palabras. El PIN se guarda como hash SHA-256 con sal,
y la app se vuelve a bloquear tras dos minutos en segundo plano.

**El color de texto sobre el acento se calcula, no se elige.** `--color-sobre-acento` es blanco
en tema claro y negro en oscuro, y eso no es una preferencia: los seis acentos claros pasan 4.5:1
contra blanco y ninguno contra negro; en oscuro es exactamente al revés. Un botón gris claro con
letras blancas no se lee, que es justo lo que pasaba antes de tener este token.

**El calendario es propio.** El panel de `<input type="date">` lo dibuja el sistema y no acepta
estilos: ignora el tema y la tipografía de la app y se ve como una pieza de otro programa. El de
`ui/CampoFecha.tsx` es HTML normal, hereda los mismos tokens y abre hacia arriba cuando el campo
está al final de un formulario.

**El tema tiene tres estados, no dos.** `data-tema` vale `claro` u `oscuro` cuando la persona
elige, y no existe cuando deja Automático; por eso el bloque de `prefers-color-scheme` se protege
con `:not([data-tema='claro'])`. Los seis acentos llevan par claro/oscuro: el azul que contrasta
sobre blanco se apaga sobre negro.

**Tú eliges el plazo; la app calcula la cuota.** En deudas se captura el total y en cuántos pagos
se liquida, y de ahí sale la mensualidad (con anualidad si hay tasa). En metas se elige para
cuándo y de ahí sale cuánto apartar al mes. Nunca al revés: el plazo es una decisión, la cuota
es una consecuencia.

**"Deuda total" y "Pagas al mes" son cosas distintas.** Si debes 9,000 y abonas 1,000 al mes, tu
deuda total es 9,000 y tu compromiso del mes es 1,000. El segundo número es el que el semáforo
descuenta del margen.

**El puntaje de salud usa la obligación mensual de deuda, no la ventana de vencimientos.** El
semáforo sí depende del calendario; un puntaje que sube y baja según el día del mes en que lo
consultas no mide nada.

## Límites conocidos

- **Los recordatorios no son push reales.** Sin servidor, la notificación de un pago próximo se
  dispara la primera vez que abres la app cada día, no a una hora fija. La pantalla de Ajustes
  lo dice con estas mismas palabras.
- **El interés de las deudas no se acumula solo.** El saldo es `monto original − pagos`. La
  proyección sí simula intereses mes a mes, pero si tu banco capitaliza, actualiza el monto a
  mano.
- **Una sola moneda a la vez.** Cambiarla reformatea lo que ves; no convierte lo ya registrado.
- **Los datos viven en este navegador.** Si borras los datos del sitio se van. Ajustes tiene
  respaldo y restauración en JSON.

## Si más adelante quieres backend

`datos/repositorio.ts` es el único módulo que escribe. Reemplazar su interior por llamadas a
Supabase o a una API propia no toca ni el dominio ni las páginas. Lo que sí habría que resolver
es la reactividad: hoy `useLiveQuery` la da gratis.
