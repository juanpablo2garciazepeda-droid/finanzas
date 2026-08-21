-- ─── Migración 2026-08-21: avisos de próximo pago por correo ──────────────
--
-- Hasta ahora el recordatorio de un vencimiento solo existía como
-- notificación del navegador, que se dispara la primera vez que abres la app
-- cada día. Quien no abre la app es justo quien necesita el aviso, así que
-- ahora también sale por correo desde un cron diario del backend.
--
-- Dos columnas en `deudas` para no repetir el mismo aviso todos los días:
--   · `ultimo_aviso_hito`  cuál de los tres hitos se mandó (previo/hoy/vencido)
--   · `ultimo_aviso_fecha` a qué vencimiento se refería
--
-- La pareja es lo que hace que un pago mensual vuelva a avisar el mes que
-- entra: cambia la fecha, así que el hito 'previo' vuelve a ser nuevo.
--
-- Aditiva e idempotente. Para correr:
--   docker exec -i <contenedor-postgres> psql -U finanzas -d finanzas \
--     < apps/backend/sql/migracion-2026-08-21-avisos-vencimiento.sql

alter table public.deudas
  add column if not exists ultimo_aviso_hito text;

alter table public.deudas
  add column if not exists ultimo_aviso_fecha text;

-- Opt-out por usuario. Arranca en true: quien ya configuró una ventana de
-- aviso está pidiendo justamente esto.
alter table public.ajustes
  add column if not exists avisos_correo_vencimientos boolean not null default true;
