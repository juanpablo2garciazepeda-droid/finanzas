# Supabase self-hosted en Dokploy

Pasos para levantar el backend. El frontend sigue desplegándose como hoy, con
`docker-compose.dokploy.yml`; esto se suma, no lo reemplaza.

## Por qué no hay un docker-compose aquí

Porque el bueno lo publica Supabase y cambia con cada versión. Copiar una foto
suya a este repositorio garantiza quedarse atrás y arrastrar fallos ya
corregidos. Se clona del origen:

```bash
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase
cp -r /tmp/supabase/docker/* infra/supabase/
```

De los servicios que trae, hacen falta: `db` (Postgres), `auth` (GoTrue),
`rest` (PostgREST), `kong` (la puerta de entrada) y `studio` (el panel).
**`realtime` y `storage` se pueden omitir**: esta app no los usa y bajan el
consumo de RAM del servidor, que es el riesgo real de un self-hosted.

## 1. Secretos propios

Los del repositorio de ejemplo son públicos y conocidos: con ellos, cualquiera
que sepa la dirección entra.

```bash
# Contraseña de Postgres y secreto de firma (mínimo 32 caracteres).
openssl rand -base64 36   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
```

`ANON_KEY` y `SERVICE_ROLE_KEY` son JWT firmados con ese `JWT_SECRET`. Se
generan con el procedimiento documentado en
<https://supabase.com/docs/guides/self-hosting/docker>.

> **`SERVICE_ROLE_KEY` nunca sale del servidor.** Esa llave ignora por completo
> el aislamiento entre usuarios: quien la tenga lee y escribe los datos de
> todos. La que va en el frontend es `ANON_KEY`, y es la única.

Comprobación después de cada despliegue:

```bash
pnpm build && grep -r "service_role\|SERVICE_ROLE" dist/ && echo "FUGA" || echo "limpio"
```

## 2. Publicar Kong con Traefik

Mismas etiquetas que el servicio `web`, con una advertencia: el router y el
servicio necesitan **nombres distintos**, que es justo lo que arregló el commit
`61eb4a2`. Sobre `api.finanzas.hotelcaracolescolima.com.mx`, apuntando al
puerto 8000 de Kong, en la red `dokploy-network`.

## 3. Cargar el esquema

```bash
psql "$DATABASE_URL" -f infra/supabase/esquema.sql
```

Crea las tablas, los índices, las políticas de aislamiento y el disparador que
prepara cada cuenta nueva con sus ajustes y sus siete categorías iniciales.

**El esquema ya está probado.** Se verificó contra Postgres 16 que un usuario no
puede leer, escribir ni borrar los datos de otro, y que sin sesión no se ve
nada. Conviene repetir esa prueba en el servidor real antes de dar acceso a
nadie, porque lo que se prueba localmente es el SQL, no tu despliegue.

## 4. Correo

GoTrue necesita SMTP para verificar direcciones y recuperar contraseñas. **Sin
esto, quien olvide su contraseña queda fuera para siempre.** Cualquier servicio
con capa gratuita sirve (Resend, Brevo). Variables: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`.

Deja activada la verificación de correo: sin ella cualquiera se registra con una
dirección que no es suya.

## 5. Respaldos

Un self-hosted sin respaldo significa que un disco muerto se lleva las finanzas
de todos los usuarios. `pg_dump` diario a un volumen aparte, siete días de
retención.

**Y prueba restaurarlo.** Un respaldo que nunca se restauró no es un respaldo,
es una carpeta con archivos.

## Estado

| Pieza | Estado |
|---|---|
| Esquema y aislamiento entre usuarios | Escrito y **probado** en Postgres 16 |
| Alta automática de cuentas nuevas | Escrito y probado |
| Compose, Traefik, SMTP, respaldos | Documentado, **sin probar**: necesita el servidor |
| Capa de sincronización en la app | Pendiente: necesita el backend arriba |
| Pantallas de entrar / registrarse | Pendientes |

Lo pendiente no se escribió a ciegas a propósito: son piezas que solo se pueden
dar por buenas ejecutándolas contra un servidor real, y entregar código de
sincronización sin haberlo corrido nunca es la mejor forma de perder datos.
