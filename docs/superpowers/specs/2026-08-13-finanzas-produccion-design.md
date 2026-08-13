# Juanpa Finanzas — De prototipo local a sistema de producción

**Fecha:** 2026-08-13
**Estado:** aprobado, listo para planear implementación

## Por qué existe este documento

La app funciona y la lógica financiera es buena, pero se diseñó bajo un supuesto
que ya no se sostiene: que vivía sola en un navegador y la usaba una persona. Al
usarla de verdad en un teléfono salieron seis problemas, y tres de ellos no se
arreglan con CSS: son consecuencia de no tener servidor.

Este documento los ordena en fases. Las fases 0–2 mejoran lo que ya existe sin
tocar infraestructura. La fase 3 es el cambio de arquitectura. Las 4–5 dependen
de ella; las notificaciones van al final por decisión del autor, para no
bloquear el resto del trabajo con lo que más depende de plataformas ajenas.

## Decisiones tomadas

| Decisión | Elegido | Descartado y por qué |
|---|---|---|
| Backend | Supabase self-hosted en Dokploy | Supabase Cloud (no depender de terceros); MariaDB + API propia (semanas de auth escrito a mano) |
| Usuarios | Multiusuario con aislamiento en la base (RLS) | Usuario único (el sistema no lo usará solo el autor) |
| Datos locales | IndexedDB se queda como caché offline | Solo-nube: registrar un gasto no puede depender de que haya señal |
| PIN | Se conserva, cambia de rol | Quitarlo: sigue siendo útil como desbloqueo rápido |
| Animación | Librería `motion` (~11 kB gzip) | A mano: cientos de líneas frágiles para lo mismo |

### La decisión de fondo: el PIN deja de fingir

Hoy [`src/estado/bloqueo.ts`](../../../src/estado/bloqueo.ts) es honesto en sus
comentarios: dice que no es autenticación, porque no hay servidor contra el cual
validar. Con la fase 3 eso cambia, pero el PIN **no se reemplaza** — se
reposiciona, igual que en las apps bancarias:

- **Supabase Auth** valida quién eres. Es la seguridad real.
- **El PIN** desbloquea una sesión que ya está autenticada, para que quien tome
  tu teléfono desbloqueado no vea los montos.

Son dos capas distintas resolviendo dos amenazas distintas. Ninguna miente sobre
lo que hace.

---

## Fase 0 — Poder ver lo que está roto

Sin esto, todo lo demás se hace a ciegas.

### 0.1 Los tests no se ejecutan

Hay 8 archivos `.test.ts` y `vitest` en devDependencies, pero
[`package.json`](../../../package.json) no tiene script `test`. Nadie los corre.

- Agregar `"test": "vitest run"` y `"test:watch": "vitest"`.
- Correrlos y **reportar el resultado tal cual**, sin arreglar nada todavía. Si
  algo ya estaba fallando, hay que saberlo antes de tocar código.

### 0.2 La app no cabe en la pantalla del teléfono

Síntoma: hay que alejar el zoom para que quepa. El viewport en
[`index.html`](../../../index.html) está correcto (`width=device-width,
initial-scale=1.0, viewport-fit=cover`), así que la causa es contenido que
desborda horizontalmente.

**No lo tapes con `overflow-x: hidden` en el `body`.** Eso esconde el síntoma y
deja el contenido inalcanzable. Hay que encontrar cada desbordamiento.

Método:

1. Correr `pnpm dev` y abrir la app con las herramientas de desarrollo en modo
   dispositivo, a **320 px, 360 px y 390 px** de ancho.
2. En cada página (Tablero, Movimientos, Presupuestos, Deudas, Metas, Ajustes),
   ejecutar en la consola:
   ```js
   [...document.querySelectorAll('*')]
     .filter(el => el.scrollWidth > document.documentElement.clientWidth)
     .map(el => ({ el, ancho: el.scrollWidth, clases: el.className }))
   ```
3. Arreglar cada elemento en su origen. Sospechosos, por probabilidad:
   - **Recharts** en [`src/graficas/Graficas.tsx`](../../../src/graficas/Graficas.tsx):
     `ResponsiveContainer` necesita un padre con ancho acotado; si el padre es
     `flex` sin `min-w-0`, el gráfico impone su ancho mínimo y estira la página.
   - **Cifras largas**: `text-[26px]` en
     [`PanelDinero.tsx`](../../../src/componentes/PanelDinero.tsx) y `text-3xl` en
     [`MedidorMargen.tsx`](../../../src/componentes/MedidorMargen.tsx). Con montos de
     seis dígitos más separadores más símbolo de moneda, a 320 px no caben.
   - **Filas de tabla** en Movimientos y Deudas: cualquier celda con
     `whitespace-nowrap` sin `min-w-0` en su contenedor flex.
   - **El selector de mes** en [`Disposicion.tsx:167`](../../../src/componentes/Disposicion.tsx#L167):
     `sm:min-w-30` combinado con nombres de mes largos ("septiembre").
4. Verificación: repetir el script de la consola en las seis páginas a los tres
   anchos. Debe devolver arreglo vacío en todos los casos.

**Regla que se aplica en toda la app:** cualquier hijo de un contenedor `flex`
que pueda tener texto largo lleva `min-w-0`. Es la causa número uno de
desbordamiento en Flexbox, porque el ancho mínimo por defecto de un ítem flex es
el de su contenido, no cero.

### Criterio de aceptación de la fase 0

- `pnpm test` corre y su salida queda registrada.
- Las seis páginas no desbordan a 320/360/390 px, verificado con el script.
- El zoom del navegador está en 100 % y todo se lee sin desplazamiento lateral.

---

## Fase 1 — Que los números se expliquen solos

Esta es la fase más importante del documento. Hay un bug conceptual y un
problema de presentación, y hay que resolverlos en ese orden.

### 1.1 El bug: `balance` significa dos cosas distintas

En [`src/dominio/alertas.ts:131`](../../../src/dominio/alertas.ts#L131):

```ts
const balance = saldo.declarado ? saldo.actual : ingresos - egresos
const margenLibre = balance - compromisoDeuda - compromisoMeta
```

- Si declaraste saldo, `balance` es **dinero acumulado** (un stock): todo lo que
  hay en la cuenta, venga de donde venga, incluidos ahorros de meses pasados.
- Si no, `balance` es el **flujo del ciclo**: lo que entró menos lo que salió en
  esta quincena.

Son magnitudes de naturaleza distinta y no se pueden usar indistintamente. Y
luego, en la línea 147, ese valor se divide entre los días que quedan:

```ts
gastoDiarioSugerido: diasRestantes > 0 ? Math.max(0, Math.floor(margenLibre / diasRestantes)) : 0
```

Con saldo declarado, esto te invita a repartir **tus ahorros completos** entre
los días que faltan de la quincena. Con 40,000 de ahorro y 3 días restantes, la
app diría "puedes gastar 13,333 hoy". Es un consejo activamente malo.

**Corrección:** separar los dos conceptos en la interfaz `Margen`.

```ts
export interface Margen {
  ciclo: Ciclo

  /** STOCK: dinero que existe ahora. Null si no se declaró saldo. */
  dineroDisponible: number | null

  /** FLUJO: lo que entró menos lo que salió en este ciclo. Siempre presente. */
  flujoDelCiclo: number

  /** FLUJO menos compromisos. Es la base del "¿puedo gastar hoy?". */
  margenLibre: number

  /** STOCK menos compromisos. Null si no hay saldo declarado. */
  colchonTotal: number | null

  // ... el resto de campos se conserva
}
```

Reglas nuevas:

- `gastoDiarioSugerido` se calcula **siempre** desde `margenLibre` (flujo), nunca
  desde el stock. Lo que se puede gastar al día sale de lo que entra en el ciclo,
  no del ahorro acumulado.
- `colchonTotal` se muestra como contexto aparte ("además tienes X de respaldo"),
  nunca se reparte entre días.
- Si el flujo del ciclo es negativo pero hay colchón, el mensaje cambia de tono:
  no es "estás en rojo", es "este ciclo vas gastando de tus ahorros".

**Se hace con TDD.** Escribir primero los casos en
[`src/dominio/alertas.test.ts`](../../../src/dominio/alertas.test.ts):

| Caso | Entrada | Esperado |
|---|---|---|
| Sin saldo declarado | ingresos 850000, egresos 300000, sin compromisos | `dineroDisponible` null, `flujoDelCiclo` 550000 |
| Con ahorro grande | saldo 4000000, flujo del ciclo 850000, 3 días restantes | `gastoDiarioSugerido` sale de 850000, no de 4000000 |
| Flujo negativo con colchón | flujo −50000, saldo 4000000 | `margenLibre` negativo, `colchonTotal` positivo, veredicto ámbar (no rojo) |
| Flujo negativo sin colchón | flujo −50000, sin saldo | veredicto rojo |
| Ciclo cerrado | `diasRestantes` 0 | `gastoDiarioSugerido` es 0, no división entre cero |

Los tests existentes que dependan del `balance` viejo hay que actualizarlos
conscientemente, uno por uno, verificando que el nuevo valor esperado es el
correcto — no ajustando el número hasta que pase.

### 1.2 La presentación: el número aparece sin origen

Caso real reportado: cuenta nueva, la app dice **2,833** y el usuario tiene
8,500 de quincena. No entiende de dónde sale.

**El número está bien.** En [`MedidorMargen.tsx:59-63`](../../../src/componentes/MedidorMargen.tsx#L59-L63)
la cifra grande es `gastoDiarioSugerido`: 8,500 libres ÷ 3 días que faltan de la
quincena = 2,833 **al día**. Lo que está mal es la comunicación:

1. La etiqueta que da todo el sentido ("puedes gastar hoy") está en `text-xs`
   debajo de una cifra en `text-3xl`. El ojo lee la cifra y se salta la etiqueta.
2. El desglose de dónde sale el 8,500 vive en
   [`PanelDinero.tsx:124-130`](../../../src/componentes/PanelDinero.tsx#L124-L130),
   que **solo se renderiza si hay saldo declarado**. En cuenta nueva no aparece
   nunca. El usuario ve el resultado de una división cuyos dos operandos están
   ocultos.

**Cambios:**

- **La unidad se vuelve parte de la cifra.** En vez de `2,833` con "puedes gastar
  hoy" debajo, mostrar `2,833 <span>/día</span>` con el sufijo en la misma línea,
  a menor tamaño y menor peso, ópticamente ligado al número.
- **Un renglón de aritmética siempre visible** bajo el medidor, en cualquier
  estado:
  `$8,500 libres ÷ 3 días que faltan = $2,833 al día`
  Con los tres números en el color de tinta y las palabras en tono suave.
- **Tocar la cifra abre una hoja con el cálculo completo**, línea por línea, con
  enlace a lo que alimenta cada renglón:
  ```
  Ingreso de la quincena          $8,500   → Ajustes
  − Gastos registrados                $0   → Movimientos
  − Pagos de deuda por vencer         $0   → Deudas
  − Aporte a metas de este ciclo      $0   → Metas
  ─────────────────────────────────────────
  = Te queda libre                $8,500
  ÷ 3 días hasta el 15 de agosto
  = Puedes gastar hoy             $2,833
  ```
  Cada renglón en cero se muestra igual, atenuado: ver los ceros enseña la
  fórmula. Ocultarlos deja la resta incompleta y vuelve el resultado mágico otra
  vez.
- **El desglose de origen se muestra también sin saldo declarado.** Cuando el
  ingreso es estimado y no registrado, decirlo en ese mismo renglón: "estimado a
  partir de tu sueldo configurado, todavía no registras el depósito". Esa
  información ya existe en `margen.ingresosEstimados` pero está enterrada al
  final del componente en `text-xs`.

### Criterio de aceptación de la fase 1

- `Margen` distingue `dineroDisponible` de `flujoDelCiclo`; ningún cálculo por
  día usa el stock.
- Los cinco casos de prueba de la tabla pasan.
- En cuenta nueva, sin tocar nada, se ve de dónde sale la cifra grande.
- La aritmética completa está a un toque de distancia.

---

## Fase 2 — Que la interfaz responda al dedo

Queja concreta: *"cada que pulsas algo se teletransporta"*. El estado activo
salta sin transición, en la barra inferior y en los segmentados de Ajustes.

### 2.1 La barra inferior

[`Disposicion.tsx:100-123`](../../../src/componentes/Disposicion.tsx#L100-L123) hoy
solo cambia el color del texto con `transition-colors`. No hay ningún elemento
que se mueva entre pestañas, así que el cambio de sección se siente instantáneo y
seco.

Rediseño:

- **Indicador que se desliza.** Una píldora o círculo detrás del ícono activo que
  viaja de una pestaña a otra. Se implementa con `layoutId` de `motion`: dos
  elementos con el mismo `layoutId` en posiciones distintas hacen que la
  librería anime la transición sola.
- **Resorte, no curva de tiempo.** Configuración base: `type: 'spring',
  stiffness: 400, damping: 32`. Un resorte con poco rebote se siente físico sin
  parecer de juguete. Ese "liquid" que pediste es esto: masa e inercia, no una
  animación lineal.
- **Responde al mantener pulsado.** Al `pointerdown`, el ícono baja a `scale
  0.92`; al soltar, vuelve con resorte. La respuesta empieza al tocar, no al
  soltar — es lo que hace que se sienta directo.
- **Arrastrable.** Deslizar el dedo horizontalmente sobre la barra mueve el
  indicador siguiendo el dedo en vivo; al soltar, se acomoda a la pestaña más
  cercana y navega ahí. Implementado con eventos de puntero sobre el contenedor
  de la barra, midiendo qué pestaña contiene la coordenada X actual.
- **Haptics donde existan.** `navigator.vibrate(8)` al cruzar de una pestaña a
  otra durante el arrastre. En iOS no hace nada y no falla; en Android cierra el
  círculo de la sensación física.
- **Área táctil de 44 px mínimo** en cada pestaña, aunque el ícono sea más chico.

### 2.2 Los segmentados de Ajustes

Mismo problema y misma solución en [`src/paginas/Ajustes.tsx`](../../../src/paginas/Ajustes.tsx):
tema (línea 103), acento (línea 134) y ciclo de pago (línea 183) son grupos de
botones donde la selección salta.

Extraer un componente **`Segmentado`** reutilizable en
`src/componentes/ui/Segmentado.tsx`, con el mismo indicador deslizante y el mismo
resorte. Los tres grupos lo consumen. Ventaja lateral: hoy los tres están escritos
por separado con clases repetidas.

### 2.3 Movimiento responsable

- Toda animación nueva respeta `prefers-reduced-motion`. El bloque ya existe en
  [`index.css:326-334`](../../../src/index.css#L326-L334), pero **`motion` no lo lee
  del CSS**: hay que usar su hook `useReducedMotion()` y, cuando esté activo,
  cambiar los valores de golpe sin transición.
- Nada de animaciones sobre `width`, `height`, `top` o `left`. Solo `transform` y
  `opacity`, que el navegador compone sin recalcular la página.
- Presupuesto de peso: `motion` no debe agregar más de ~15 kB gzip al bundle.
  Verificar con `pnpm build` antes y después, y anotar ambos números.

### Criterio de aceptación de la fase 2

- El indicador viaja entre pestañas; no hay saltos.
- Mantener pulsado da respuesta visual inmediata.
- Se puede arrastrar el dedo por la barra y soltar en otra sección.
- Con "reducir movimiento" activo en el sistema, todo cambia de golpe sin animar.
- El bundle creció menos de 15 kB gzip.

---

## Fase 3 — Backend real: login, nube y aislamiento

La fase grande. Todo lo anterior es de presentación; esto reestructura la capa de
datos.

### 3.1 Infraestructura

Supabase self-hosted en el Dokploy que ya corre el frontend. El
[`docker-compose.dokploy.yml`](../../../docker-compose.dokploy.yml) actual solo
tiene el nginx del frontend, así que se agregan servicios sin romper nada.

**Sacar el compose de la fuente oficial**, no de memoria:

```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker/* ./infra/supabase/
```

De ese compose se necesitan, como mínimo: `db` (Postgres), `auth` (GoTrue),
`rest` (PostgREST), `kong` (puerta de entrada) y `studio` (panel de
administración). `realtime` y `storage` no hacen falta para esta app y se pueden
omitir para bajar el consumo del servidor.

Ajustes obligatorios sobre el compose base:

- **Generar secretos propios.** `POSTGRES_PASSWORD`, `JWT_SECRET` (mínimo 32
  caracteres), `ANON_KEY` y `SERVICE_ROLE_KEY`. Los del repo de ejemplo son
  públicos y conocidos. Las llaves anon/service se derivan firmando con el
  `JWT_SECRET`; Supabase documenta el procedimiento.
- **Nunca exponer `SERVICE_ROLE_KEY` al frontend.** Esa llave se salta el
  aislamiento entre usuarios por completo. Solo vive en el servidor. La que va en
  el frontend es `ANON_KEY`.
- **Etiquetas de Traefik** para publicar Kong en `api.finanzas.…` con TLS de
  Let's Encrypt, siguiendo el patrón exacto que ya usa el servicio `web` (router
  y servicio con nombres distintos, que es justo lo que arregló el commit
  `61eb4a2`).
- **Volumen persistente** para los datos de Postgres, y confirmar que Dokploy no
  lo borre entre despliegues.
- **Respaldo automático:** un `pg_dump` diario a un volumen aparte, con retención
  de 7 días. Sin esto, self-hosted significa que un disco muerto se lleva las
  finanzas de todos.

### 3.2 Esquema y aislamiento

Una tabla por cada tabla de Dexie en
[`src/datos/db.ts:33-42`](../../../src/datos/db.ts#L33-L42), más una columna
`user_id uuid not null references auth.users(id) on delete cascade`.

Convenciones que se mantienen del dominio actual
([`tipos.ts`](../../../src/dominio/tipos.ts)):

- Los montos son **enteros en centavos**. En Postgres: `bigint`, jamás `float` ni
  `numeric` con decimales. Un float en dinero es un error de redondeo esperando.
- Las fechas del dominio son texto `YYYY-MM-DD` y los periodos `YYYY-MM`.
  Mantenerlos como `text` con una restricción `check`, no convertirlos a `date`:
  la lógica en [`src/dominio/fechas.ts`](../../../src/dominio/fechas.ts) compara
  cadenas y funciona bien así.

**Row Level Security en todas las tablas, sin excepción:**

```sql
alter table public.transacciones enable row level security;

create policy "cada quien ve lo suyo"
  on public.transacciones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`using` filtra lo que se puede leer; `with check` impide escribir filas a nombre
de otro. Hacen falta las dos. La base de datos es la que garantiza el
aislamiento — si el frontend tiene un bug, un usuario sigue sin poder leer los
datos de otro.

**Verificación obligatoria antes de dar la fase por terminada:** crear dos
usuarios de prueba, cargar datos con cada uno, e intentar leer los del primero
autenticado como el segundo. Debe devolver cero filas. Escribir esa prueba, no
solo hacerla a mano.

### 3.3 Sincronización sin perder el modo sin conexión

Dexie **no se elimina**. Pasa a ser caché local, y esto es un requisito, no un
lujo: registrar un gasto en la fila del súper no puede depender de la señal.

Arquitectura: `repositorio.ts` ya es el único punto por el que pasa la escritura
([364 líneas](../../../src/datos/repositorio.ts)), así que es la costura natural.

1. **Escribir local primero.** La UI responde al instante contra IndexedDB, igual
   que hoy. `useLiveQuery` en
   [`finanzas.tsx:65`](../../../src/estado/finanzas.tsx#L65) no se toca.
2. **Cola de cambios pendientes.** Una tabla nueva de Dexie, `pendientes`, con la
   operación, la tabla, el id y la marca de tiempo.
3. **Empujar cuando haya red.** Al recuperar conexión y al abrir la app, mandar la
   cola a Supabase en orden y vaciarla conforme se confirme.
4. **Traer lo remoto.** Al iniciar sesión y al volver del segundo plano, bajar lo
   que cambió desde la última sincronización.
5. **Conflictos: gana la escritura más reciente**, comparando `creadoEn`. Para
   esta app es suficiente y hay que decidirlo explícitamente ahora, no
   descubrirlo cuando dos dispositivos se contradigan.

**Migración de los datos que ya existen:** al primer inicio de sesión, si hay
datos en IndexedDB sin `user_id`, preguntar *"encontré movimientos guardados en
este dispositivo, ¿los subo a tu cuenta?"*. Si acepta, subirlos asignándoles su
`user_id`. **Nunca borrar lo local antes de confirmar que la subida terminó
bien.**

### 3.4 Pantallas de autenticación

Nuevas, en `src/paginas/`:

- **Entrar**: correo y contraseña.
- **Crear cuenta**: correo, contraseña, confirmación. Mínimo 8 caracteres —
  validar en el cliente *y* dejar que Supabase valide también.
- **Recuperar contraseña**: envía enlace por correo. Requiere configurar SMTP en
  GoTrue; sin eso, nadie que olvide su contraseña puede volver a entrar. Un
  servicio gratuito como Resend o Brevo alcanza para el volumen.
- **Verificación de correo activada.** Sin ella, cualquiera se registra con un
  correo que no es suyo.

Interacción con el PIN, en este orden exacto al abrir la app:

1. ¿Hay sesión de Supabase válida? Si no → pantalla de Entrar.
2. ¿Hay PIN configurado y la sesión local está cerrada? Si sí → pantalla de PIN.
3. Entra a la app.

La lógica de segundo plano que ya existe en
[`bloqueo.ts:76-92`](../../../src/estado/bloqueo.ts#L76-L92) se conserva tal cual:
está bien resuelta.

### Criterio de aceptación de la fase 3

- Dos usuarios distintos no pueden ver los datos del otro, verificado con una
  prueba automatizada.
- La app registra movimientos con el modo avión activado, y se sincronizan al
  volver la señal.
- Los datos locales previos migran a la cuenta sin pérdida.
- La recuperación de contraseña llega al correo y funciona de punta a punta.
- `SERVICE_ROLE_KEY` no aparece en ningún archivo del bundle del frontend.
  Verificar con `grep -r` sobre `dist/`.
- Hay un respaldo de Postgres corriendo y se probó restaurarlo al menos una vez.

---

## Fase 4 — Cierre de producción

### 4.1 El PIN falla abierto

[`bloqueo.ts:47-52`](../../../src/estado/bloqueo.ts#L47-L52):

```ts
export async function pinCorrecto(pin: string): Promise<boolean> {
  const guardado = localStorage.getItem(CLAVE_HASH)
  const sal = localStorage.getItem(CLAVE_SAL)
  if (!guardado || !sal) return true   // ← cualquier PIN entra
  return (await resumen(pin, sal)) === guardado
}
```

Se justifica cuando no hay PIN configurado, pero si el almacenamiento se corrompe
o alguien borra la llave desde las herramientas del navegador, el candado se abre
solo. Separar las dos preguntas: `hayPin()` decide si hay que pedirlo,
`pinCorrecto()` solo valida y devuelve `false` cuando no encuentra con qué
comparar.

Agregar además: **límite de intentos**. Cinco fallos → espera de 30 segundos, que
se duplica en cada tanda. Guardar el contador en `localStorage` para que recargar
la página no lo reinicie.

### 4.2 Umbrales proporcionales, no fijos

[`recomendaciones.ts:30-32`](../../../src/dominio/recomendaciones.ts#L30-L32):

```ts
const HORMIGA_MINIMO_MOVIMIENTOS = 8
const HORMIGA_TOPE = 15_000        // $150
```

Y a lo largo del archivo aparecen otros: `50_000` ($500) como "dinero libre
relevante" en la línea 100, `100_000` ($1,000) como "categoría cara" en la 191,
`20_000` ($200) para suscripciones en la 243.

Para quien cobra 8,500 quincenales, $150 es un gasto considerable. Para quien
cobra 50,000 mensuales, es ruido. **Estos umbrales deben derivarse del ingreso**:

- Gasto hormiga: menos del 2 % del ingreso del ciclo.
- Dinero libre relevante: más del 5 % del ingreso mensual.
- Categoría cara: más del 10 % del ingreso mensual.

Con un piso absoluto para cuando el ingreso es cero o no está configurado, para
no dividir entre cero ni marcar todo. Los tests de
[`recomendaciones.test.ts`](../../../src/dominio/recomendaciones.test.ts) se
actualizan con casos de ingreso alto e ingreso bajo, verificando que la misma
transacción se clasifica distinto según quién la hizo.

### 4.3 Revisión general de lógica

Puntos a revisar con calma, cada uno con su prueba:

- **`compromisoMeta`** en [`alertas.ts:119`](../../../src/dominio/alertas.ts#L119):
  `Math.ceil(pendienteMes / ciclo.restantesEnMes)`. Verificar el comportamiento
  cuando `restantesEnMes` es 1 (último ciclo del mes) y cuando el aporte ya se
  cubrió completo.
- **Saturación de recomendaciones**: `generarRecomendaciones` puede devolver más
  de quince entradas simultáneas. Confirmar cuántas muestra el Tablero; si son
  todas, limitar a las 3–5 de mayor prioridad con un "ver todas". Una lista de
  quince consejos no se lee.
- **`saldoActual` en Deuda y `montoActual` en Meta** son valores derivados que se
  guardan materializados ([`tipos.ts:61`](../../../src/dominio/tipos.ts#L61) y
  [`tipos.ts:85`](../../../src/dominio/tipos.ts#L85)). Con sincronización entre
  dispositivos pueden quedar desfasados del historial de pagos. Escribir una
  función que los recalcule desde los movimientos y correrla al sincronizar.
- **Cobertura de la capa de dominio**: hoy hay tests de dinero, fechas, ciclos,
  saldo, salud, deudas, metas, categorías, alertas y recomendaciones. Falta
  [`presupuestos.ts`](../../../src/dominio/presupuestos.ts). Agregarlo.

### 4.4 Higiene del repositorio

- [`package-lock.json`](../../../package-lock.json) aparece borrado y hay
  `pnpm-lock.yaml` sin commitear. Cerrar la migración a pnpm: confirmar que el
  [`Dockerfile`](../../../Dockerfile) usa pnpm y commitear el lock.
- Ningún secreto en el repositorio. Las llaves de Supabase por variable de
  entorno, con un `.env.example` documentado sin valores reales.

### Criterio de aceptación de la fase 4

- El PIN falla cerrado y limita intentos.
- Los umbrales escalan con el ingreso, con pruebas de ingreso alto y bajo.
- `presupuestos.ts` tiene pruebas.
- `pnpm test` pasa completo.
- No hay secretos en el repositorio, verificado con `git grep`.

---

## Fase 5 — Notificaciones que sí llegan

### 5.1 El diagnóstico correcto

El mensaje "tu navegador no soporta notificaciones" viene de
[`recordatorios.ts:16-18`](../../../src/estado/recordatorios.ts#L16-L18), que
pregunta si existe `Notification` y, al no encontrarla, se rinde.

**Casi seguro es un iPhone.** En iOS, la API de notificaciones no existe en
Safari **a menos que la app esté instalada en la pantalla de inicio**. Desde iOS
16.4 sí hay Web Push, pero solo en modo instalado. El navegador sí puede: falta
instalar la app y falta el service worker que reciba el aviso — hoy solo hay un
[`manifest.webmanifest`](../../../public/manifest.webmanifest), sin worker.

Además, aunque funcionara, el diseño actual solo avisa **cuando abres la app**
(el comentario en el archivo lo admite). Un recordatorio de pago que requiere que
abras la app para enterarte no es un recordatorio.

### 5.2 Las tres capas

**Capa 1 — Mensaje honesto en lugar del actual.**
Detectar iOS sin instalar (`navigator.standalone === false` junto con user agent
de iOS) y, en vez del mensaje derrotista, mostrar las instrucciones con los
nombres reales de los botones: *Compartir → Añadir a pantalla de inicio*. Ilustrado,
en la pantalla de Ajustes. Para Android/escritorio, capturar el evento
`beforeinstallprompt` y ofrecer instalar con un botón.

**Capa 2 — Push real, que llega con la app cerrada.**

- Service worker en `public/sw.js` con el manejador de `push` y de
  `notificationclick` (que abre la app en la pantalla de Deudas).
- Suscripción con VAPID: generar el par de llaves, guardar la pública en el
  frontend y la privada solo en el servidor. La suscripción de cada dispositivo se
  guarda en una tabla `suscripciones_push` con su `user_id` y RLS.
- **Quien dispara:** una tarea programada en el servidor que corre una vez al día,
  consulta los vencimientos dentro de la ventana `diasAvisoVencimiento` de cada
  usuario, y manda el push. Con Supabase self-hosted, `pg_cron` sobre la base más
  una función que llame al servicio de push. Alternativa igual de válida: un
  contenedor pequeño en Dokploy con un cron. Elegir una y documentarla.
- El texto de la notificación ya está bien escrito en
  [`recordatorios.ts:40-47`](../../../src/estado/recordatorios.ts#L40-L47) — se
  reutiliza esa lógica, movida al servidor.

**Capa 3 — Correo como respaldo.**
Push falla por muchas razones fuera de tu control: permisos revocados, el usuario
nunca instaló la app, el navegador purgó la suscripción. Un correo diario de
recordatorio, activable en Ajustes, es el canal que siempre llega. Usa el mismo
SMTP que ya se configuró para la recuperación de contraseña en la fase 3.

Y siempre, sin depender de nada externo: un **centro de recordatorios dentro de la
app**, con lo que vence pronto, visible al abrir.

### 5.3 Regla sobre los permisos

No pedir permiso de notificaciones al abrir la app. Pedirlo cuando el usuario
active los recordatorios en Ajustes, con el contexto ya explicado. Un permiso
pedido en frío se niega, y **una vez negado no se puede volver a preguntar por
código** — el usuario tiene que ir a la configuración del sistema. Una sola
oportunidad, hay que usarla bien.

### Criterio de aceptación de la fase 5

- En iPhone sin instalar, el mensaje explica cómo instalar en vez de rendirse.
- Instalada en pantalla de inicio, llega una notificación de prueba.
- Llega un recordatorio **con la app cerrada**, disparado desde el servidor.
- El correo de respaldo llega.
- El permiso se pide en Ajustes, nunca al abrir.

---

## Cómo trabajar este plan

**Una fase por sesión.** Son independientes salvo por las dependencias marcadas
(5 necesita 3). No intentar más de una a la vez: el contexto se diluye y las
verificaciones se saltan.

**Reglas que aplican a todas las fases:**

- **TDD en todo lo que toque `src/dominio/`.** Prueba que falla primero, después
  el código. La lógica financiera equivocada es peor que la ausencia de lógica,
  porque se le cree.
- **Al modificar un test existente**, verificar que el nuevo valor esperado es
  correcto por razonamiento, no ajustarlo hasta que pase.
- **Seguir el estilo del código existente**: nombres en español, comentarios que
  explican *por qué* y no *qué*, montos en centavos enteros.
- **Verificar antes de declarar terminado.** Correr el comando, leer la salida,
  reportarla. Si algo falló, decirlo con la salida a la vista.
- **No ampliar el alcance.** Si aparece un problema fuera de la fase actual,
  anotarlo al final de este documento y seguir.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Supabase self-hosted es varios contenedores en un servidor que quizá tenga poca RAM | Omitir `realtime` y `storage`. Medir el consumo antes de exponerlo |
| Un disco muerto se lleva las finanzas de todos los usuarios | Respaldo diario **y probar la restauración**, no solo configurarla |
| La sincronización pierde datos en un conflicto | Escribir local primero, nunca borrar antes de confirmar, gana la escritura más reciente |
| Push en iOS depende de que el usuario instale la app | Correo de respaldo y centro de recordatorios dentro de la app |
| La fase 1 cambia números que el usuario ya vio | Explicar el cambio en la app la primera vez que abra tras la actualización |

---

## Bitácora

### Fase 0 — completada el 2026-08-13

**Tests:** se agregaron `test` y `test:watch` a `package.json`. La suite completa
pasa: **10 archivos, 137 pruebas, sin fallos**. No había nada roto escondido;
simplemente nadie los estaba corriendo.

**Desbordamiento: el diagnóstico inicial estaba a medias.** La auditoría real
mostró que `document.documentElement.scrollWidth` **nunca** excede el viewport —
la página no crece a lo ancho. Lo que desbordaba eran las **celdas interiores**:
el texto se salía de su tarjeta y se encimaba, que es lo que empuja a alejar el
zoom aunque no haya barra de desplazamiento lateral.

Medido a 320 px con datos demo:

| Elemento | Necesitaba | Tenía |
|---|---|---|
| `$11,000` / `$14,902` (Movimientos) | 70 px | 56 px |
| `$129,400` (Tablero y Deudas) | 108 px | 106 px |
| Etiqueta "Compromiso" (Deudas) | 68 px | 61 px |

A 360 px y 390 px no había ningún desbordamiento. **Por qué le pasa en un iPhone
moderno:** iOS tiene *Zoom de pantalla* (Ajustes → Pantalla y brillo → Zoom de
pantalla → Ampliado); con esa opción activa, un iPhone de 390 px reporta 320 px
lógicos. Es la explicación más probable del síntoma reportado.

**Correcciones aplicadas:**

- Utilidades de tamaño fluido en `src/index.css` (`cifra-xl`, `cifra-lg`,
  `cifra-md`, `etiqueta-celda`), con `clamp()` en vez de tamaños fijos. Se
  eligió tamaño fluido y no puntos de quiebre porque el problema es continuo: un
  breakpoint dejaría los anchos intermedios rotos.
- `Cifra` en `src/componentes/ui/Basicos.tsx` usa `cifra-xl` por omisión y lleva
  `min-w-0`.
- `src/paginas/Movimientos.tsx`: el grid de tres montos reduce espaciado en
  móvil (`gap-2 sm:gap-3`, `px-2.5 sm:px-4`) y vuelve al normal con ancho.
- `src/paginas/Deudas.tsx`: la rejilla de tres celdas usa padding reducido en
  móvil y las clases fluidas.
- `src/componentes/MedidorMargen.tsx`: el arco SVG lleva `max-w-full`; su ancho
  fijo de 224 px era la única medida rígida que quedaba.

**Verificación:** 21 combinaciones (6 rutas + el modal de registrar, en 320/360/
390 px) sin un solo desbordamiento. `pnpm test` 137/137. `pnpm build` compila.
`pnpm lint` solo arroja avisos de *fast refresh* preexistentes, ajenos a estos
cambios.

**Método de verificación reproducible:** se automatizó con Playwright apuntando
al Chromium ya presente en la caché del sistema, corriendo fuera del repositorio
para no agregar dependencias. El script recorre cada ruta —recordando que la app
usa `HashRouter`, así que las rutas van tras `#`— siembra datos demo y busca
elementos cuyo `scrollWidth` exceda su `clientWidth`. Vale la pena convertirlo en
prueba de regresión cuando se agreguen pruebas E2E.

### Hallazgos fuera de alcance, para fases posteriores

- ~~**El bundle principal pesa 886 kB (264 kB gzip)**, culpa de `jspdf` +
  `html2canvas`.~~ **Corregido en la fase 4, y el diagnóstico estaba mal:** el
  PDF ya se cargaba de forma diferida desde `Ajustes.tsx`, así que nunca estuvo
  en el arranque. El peso era de Recharts.
- **Margen de seguridad:** a 280 px sí hay desbordamientos (el segmentado de
  tema con la palabra "Automático", la etiqueta "Compromiso"). No se corrigió
  porque ningún teléfono real es tan angosto, pero significa que el margen sobre
  320 px es de aproximadamente 12 %: montos de siete dígitos podrían volver a
  apretar la rejilla de Movimientos.

### Fase 1 — completada el 2026-08-13

**El bug de fondo, corregido.** `Margen` ya distingue las dos magnitudes:
`dineroDisponible` / `colchonTotal` son stock; `flujoDelCiclo` / `margenLibre`
son flujo. El campo ambiguo `balance` desapareció, y `gastoDiarioSugerido` sale
siempre del flujo. Con 40,000 de ahorro y tres días de quincena, la app ya no
sugiere gastar 13,333 al día.

Se hizo con TDD: cinco pruebas nuevas fallando primero, después el código. Al
renombrar `balance` fallaron cuatro pruebas más; en las cuatro no había saldo
declarado, así que `balance` era exactamente el flujo y el valor esperado no
cambió — solo el nombre. Se verificó caso por caso, no ajustando números hasta
que pasaran.

**El veredicto ahora distingue dos situaciones que antes eran la misma.** Gastar
más de lo que entró teniendo ahorro con qué cubrirlo es ámbar ("estás tirando de
tu ahorro"); sin ahorro es rojo. Antes ambas eran rojo.

**La cifra grande se explica sola:**

- La unidad va pegada al número (`2,833 /día`), no como pie de foto en 12 px.
- Debajo, la aritmética siempre visible: `$8,500 libres ÷ 3 días = $2,833 al día`.
- Al tocarla se abre `DesgloseMargen`, con el cálculo renglón por renglón y los
  ceros a la vista, porque ocultarlos deja la resta incompleta.
- Ya no depende de haber declarado saldo: en cuenta nueva también aparece.

`PanelDinero` dejó de llamar "te puedes permitir" al stock; ahora dice "te queda
de respaldo" y menciona el margen del ciclo aparte.

### Fase 2 — completada el 2026-08-13

Se agregó `motion` (13.1.0). La barra inferior tiene una píldora que viaja entre
secciones con resorte (`stiffness: 400, damping: 32`), los iconos responden al
`pointerdown` y no al soltar, y se puede arrastrar el dedo por la barra para
recorrer secciones antes de decidir, con un golpecito háptico al cruzar cada
una. Área táctil de 44 px por pestaña.

Los tres grupos de botones de Ajustes (tema, acento, ciclo de cobro) estaban
escritos por separado con las clases repetidas; ahora comparten un componente
`Segmentado` con el mismo indicador y el mismo resorte.

Todo respeta `prefers-reduced-motion` vía `useReducedMotion()`: el bloque CSS
que ya existía no basta, porque motion no lo lee.

**Un bug propio, encontrado mirando capturas y no el código:** la pastilla del
segmentado no se veía. El `-z-10` la mandaba detrás del fondo del contenedor
padre. En la barra inferior sí funcionaba porque ese contenedor no tiene fondo
propio. Corregido elevando el contenido en vez de hundir la pastilla.

### Fase 4 — completada el 2026-08-13

**El PIN falla cerrado.** `pinCorrecto()` devuelve `false` cuando no encuentra
con qué comparar; quien decide si hay que pedirlo es `hayPin()`. Se agregó
límite de intentos: cinco fallos imponen 30 segundos de espera, que se duplica
en cada tanda. El contador vive en `localStorage` y no en `sessionStorage`, para
que recargar la página no lo reinicie. `bloqueo.ts` no tenía ninguna prueba;
ahora tiene 11.

**Umbrales proporcionales al ingreso.** Estaban clavados en pesos: $150 de
"gasto hormiga", $500 de "dinero libre", $1,000 de "categoría cara". Ahora se
derivan del ingreso mensual (2 %, 5 %, 10 %) con un piso absoluto para cuando no
hay ingreso configurado. Hay pruebas de que ocho gastos de $120 son hormiga con
ingreso alto y dejan de serlo con ingreso bajo.

**`presupuestos.ts` pasó de cero pruebas a 16**, incluidos los casos que
importan: sobregiro con restante negativo, límite en cero sin consumo infinito,
categoría borrada, y variación nula cuando no hay base de comparación.

**Arranque un 27 % más ligero.** Las tres gráficas cargan con `lazy()` y un
hueco de la altura correcta para que nada brinque: 886 kB → 619 kB (264 → 193 kB
gzip).

### Fase 3 — parcial, 2026-08-13

Lo que **está hecho y probado**: `infra/supabase/esquema.sql` con las nueve
tablas, los índices, las políticas de aislamiento y el disparador que prepara
cada cuenta nueva. Se levantó un Postgres 16 en Docker reproduciendo el esquema
`auth` de Supabase y se verificó que:

- un usuario ve **cero** filas de otro;
- ve solo sus 7 categorías, nunca las 14;
- **no puede escribir** a nombre de otro (la política rechaza el INSERT);
- **no puede borrar** datos ajenos (cero filas afectadas);
- sin sesión no se ve nada.

También `infra/supabase/README.md` con los pasos de despliegue y `.env.example`.

Lo que **no está hecho, a propósito**: el compose de Dokploy, el SMTP, los
respaldos, la capa de sincronización y las pantallas de entrar/registrarse.
Todo eso solo se puede dar por bueno ejecutándolo contra un servidor real, y
entregar código de sincronización que nunca se ha corrido es la mejor forma de
perder datos de alguien.

### Estado al cierre

`pnpm test` 173/173 · `pnpm build` compila · `pnpm lint` 5 avisos de fast-refresh
preexistentes · 21 de 21 pantallas sin desbordamiento a 320/360/390 px · sin
secretos en `dist/`.

**Siguiente paso:** levantar Supabase en Dokploy. Hasta que eso exista, las
fases 3 y 5 no pueden avanzar.
