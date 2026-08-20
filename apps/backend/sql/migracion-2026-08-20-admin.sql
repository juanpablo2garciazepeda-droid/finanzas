-- ─── Migración: usuario admin ────────────────────────────────────────────
--
-- Promueve al usuario inicial a `rol = 'admin'` para que pueda entrar
-- al panel /admin y gestionar el resto de las cuentas.
--
-- Es idempotente: si ya es admin, no hace nada.
--
-- Para crear más admins desde el panel: una vez logueado como admin, abrir
-- la fila de un usuario en /admin y cambiar su rol a "admin".
--
-- Para correr:
--   docker exec -i <contenedor-postgres> psql -U finanzas -d finanzas \
--     < apps/backend/sql/migracion-2026-08-20-admin.sql
-- o desde psql interactivo pegar el contenido.

update users
   set rol = 'admin'
 where lower(email) = lower('admin@finanzasgz.com.mx')
   and rol <> 'admin';
