# Finanzas GZ

App web de control financiero personal: gastos, presupuestos, deudas, metas de ahorro y un
semáforo que responde a la única pregunta que importa antes de pagar — **¿puedo gastar esto?**

Son dos piezas: un SPA de React que se sirve como archivos estáticos y una API de NestJS sobre
Postgres. Los datos viven en el servidor, atados a una cuenta con correo verificado, y se
pueden exportar y borrar enteros desde Ajustes.

## Cómo correrla

**Frontend**

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm test        # 166 pruebas del dominio
pnpm build       # bundle de producción en dist/
```

Por defecto apunta a `https://api.finanzasgz.com.mx`. Para desarrollar contra un backend
local, `VITE_API_URL=http://localhost:3000 pnpm dev`.

**Backend con Postgres local**

```bash
docker run -d --name finanzas-pg \
  -e POSTGRES_USER=finanzas -e POSTGRES_PASSWORD=localtest -e POSTGRES_DB=finanzas \
  -p 5432:5432 postgres:16-alpine

cd apps/backend
for f in sql/esquema.sql sql/migracion-*.sql; do
  docker exec -i finanzas-pg psql -U finanzas -d finanzas < "$f"
done

npm install && npm run build
DATABASE_HOST=localhost DATABASE_PORT=5432 DATABASE_USER=finanzas \
DATABASE_PASSWORD=localtest DATABASE_NAME=finanzas \
JWT_SECRET=$(openssl rand -hex 48) EMAIL_MODE=console \
APP_URL=http://localhost:5173 CORS_ORIGINS=http://localhost:5173 \
node dist/main.js
```

Con `EMAIL_MODE=console` los correos no se envían: se imprimen en el log del backend, con el
código de verificación bien visible. Es la forma de probar el alta sin configurar SMTP.

Al registrarse, un trigger de Postgres siembra las 17 categorías iniciales y la fila de
ajustes. La cuenta arranca vacía de movimientos a propósito.

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
    saldo.ts          Cuánto dinero hay de verdad, ahora
    presupuestos.ts   Gasto contra límite, comparativa mes a mes
    deudas.ts         Amortización, vencimientos, método avalancha
    metas.ts          Proyección de llegada y aporte necesario
    alertas.ts        El semáforo y el cálculo del margen  ← el corazón
    salud.ts          Puntaje 0-100 y series históricas
    recomendaciones.ts  Reglas que producen consejos accionables
    *.test.ts         166 pruebas sobre todo lo anterior

  api/            Cliente HTTP y manejo del JWT.
    cliente.ts        fetch tipado; limpia el token en cualquier 401

  datos/          Persistencia. El único lugar que habla con la API.
    repositorio.ts    Todas las lecturas y escrituras; convierte bigint↔number
    categoriasIniciales.ts

  estado/         Puente entre datos y UI.
    auth.tsx          Sesión, registro, canje del código de verificación
    finanzas.tsx      Contexto con todo lo del usuario
    avisos.tsx        Toasts con deshacer
    i18n.tsx          Diccionario es/en
    recordatorios.ts  Notificaciones de vencimientos

  componentes/    UI reutilizable.
    Marca.tsx         Símbolo y logotipo de Finanzas GZ
    Avatar.tsx        Foto de perfil con la inicial como respaldo
    LimiteDeError.tsx Red de seguridad: un error de render no deja pantalla negra
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

**El dominio no sabe que existe React ni la API.** Por eso el motor de alertas se prueba sin
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

**La app no puede adivinar cuánto tienes en el banco.** Nadie registra su vida financiera desde el
día cero, así que el saldo se declara una vez —"hoy tengo esto"— y a partir de esa foto se suman
los ingresos y se restan gastos, abonos a deudas y aportes a metas. Con saldo declarado el margen
parte del dinero real; sin él solo se puede razonar sobre flujos, que es útil pero no responde a
"¿cuánto tengo?". Los aportes a metas salen del saldo a propósito: ese dinero se apartó y dejó de
ser gastable.

**El dinero estimado nunca se muestra como dinero real.** Mientras no haya un ingreso registrado
en el ciclo, el margen se calcula con una estimación del sueldo: eso mantiene la app útil el día 1.
Pero la tarjeta dice "estimados, aún sin registrar" en vez de "entraron", y el tablero pregunta
"¿Ya cobraste?" con un botón que convierte la estimación en un movimiento de verdad. Confundir
las dos cosas es lo que hace que los números parezcan no cuadrar cuando borras un ingreso y la
cifra no se mueve.

**El puntaje de salud exige al menos dos componentes con datos.** Con uno solo, el promedio es ese
componente: alguien sin deudas ni movimientos sacaría 100 y se le estaría diciendo que su salud es
sólida cuando no se sabe nada de ella.

**El registro pide una cosa por pantalla.** Nombre, correo, contraseña, foto y código: cinco
pasos en vez de un formulario de nueve controles. Cada pantalla valida lo suyo en el momento, y
el error sale junto al campo que lo provocó y no al final de un scroll.

**La verificación va por código, no solo por enlace.** El correo casi nunca se abre en el mismo
aparato donde uno se está registrando; con enlace hay que saltar de dispositivo y perder el
contexto, con código se teclea en la pestaña que ya está abierta. El enlace sigue funcionando
para quien lo tenga a la mano: son dos formas de canjear la misma fila, y usar una consume la
otra. El código son 6 dígitos, se guarda hasheado, vence en 30 minutos y muere a los 6 intentos
fallidos.

**La foto de perfil se recorta en el navegador.** Sale de la cámara pesando 4 MB y llega al
servidor como un JPEG de 256×256 de unos 25 KB, recortado al centro para no deformar caras. Se
guarda como data URL en la propia fila del usuario: son dos contenedores sin almacenamiento de
objetos, y montar un bucket para decenas de KB no se paga. El backend rechaza SVG —ejecuta
script— y cualquier URL que no sea un data URL de imagen.

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
- **Sin conexión no hay app.** Todo se lee de la API en cada arranque; no hay caché local ni
  cola de escrituras pendientes.
- **`cargarTodo()` hace una petición por deuda y por meta.** Con tres deudas y dos metas son
  once llamadas por carga del tablero. Funciona, pero el día que alguien tenga veinte deudas
  hará falta un endpoint que devuelva pagos y aportes en bloque.
- **El límite de peticiones es por IP, no por cuenta.** Son 100 por minuto: de sobra para una
  persona, pero varias detrás de la misma IP —una oficina, el NAT de una operadora móvil— se
  lo reparten.

## Backend

`apps/backend` es una API de NestJS sobre Postgres con TypeORM.

- **El aislamiento entre usuarios se aplica en la capa de servicio.** `AuthCrudService` filtra
  todo por el `userId` que sale del JWT; no hay Row Level Security. Pedir un registro ajeno
  devuelve 404 y no 403 a propósito: un 403 confirmaría que ese id existe.
- **Los DTO validan la entrada de todos los recursos.** Sin ellos, un tipo TypeScript como
  `DeepPartial<Deuda>` se convierte en `Object` en tiempo de ejecución y el `ValidationPipe` de
  Nest se salta la validación entera.
- **Los montos viajan como cadenas de dígitos.** Son `bigint` en Postgres y JSON no tiene
  enteros de 64 bits.
- **Las migraciones son archivos sueltos en `sql/`, aditivos y repetibles.** Se aplican en
  orden por fecha y usan `IF NOT EXISTS`; correr una dos veces no rompe nada.
