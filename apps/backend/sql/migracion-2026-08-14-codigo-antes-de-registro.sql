-- Migración 2026-08-14: verificar el correo ANTES de crear la cuenta
--
-- El alta pasa de "crea la cuenta y luego confirma" a "confirma y luego crea":
-- se teclea el correo, llega el código, se canjea, y solo entonces se piden
-- contraseña y foto. Así no quedan cuentas a medio nacer de quien se arrepiente
-- a mitad del formulario, ni filas de usuarios con correos que nadie confirmó.
--
-- Eso obliga a guardar el código sin un `usuario_id` al que colgarlo, que es
-- justo lo que `tokens_verificacion` exige (la columna es NOT NULL y tiene FK).
-- De ahí una tabla propia con el correo como única identidad.
--
-- `tokens_verificacion` sigue en uso para lo que ya no cabe aquí: el cambio de
-- correo de una cuenta existente y las cuentas viejas sin verificar.

create table if not exists public.codigos_registro (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- SHA-256 del código de 6 dígitos, por la misma razón que los otros tokens:
  -- un dump de la base no debe entregar altas listas para usar.
  codigo_hash text not null,
  -- Un código son un millón de combinaciones; sin tope, un bot las recorre.
  intentos integer not null default 0,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- Al canjear se busca el más reciente vivo de ese correo.
create index if not exists idx_codigos_registro_email
  on public.codigos_registro (email, creado_en desc);
