-- Migración 2026-08-14: blindar el sistema de auth
--
-- Cubre el resto del checklist de login/registro robusto:
--   · Email verification (email_verificado + tokens_verificacion)
--   · Logout-all-devices (token_version)
--   · Roles (admin/usuario)
--   · Password reset con link temporal (tokens_reset_password)
--   · Auditoría de eventos sensibles (auditoria)
--   · Forzar cambio de password en próximo login (debe_cambiar_password)
--
-- Las nuevas columnas de `users` se añaden con defaults razonables para que
-- los usuarios existentes sigan funcionando:
--   · email_verificado=TRUE (grandfathered)
--   · token_version=0 (no se ha invalidado nada)
--   · rol='usuario'
--
-- El backend, en su servicio de auth, será el que cree los tokens y emita
-- los emails (o los imprima por consola mientras no haya SMTP real).

-- ── Extensión pgcrypto ya está en el esquema base, pero por si se corre sola ──
-- create extension if not exists "pgcrypto";

-- ── Nuevas columnas en users ─────────────────────────────────────────────────

alter table public.users
  add column if not exists email_verificado boolean not null default true,
  add column if not exists token_version integer not null default 0,
  add column if not exists rol varchar(20) not null default 'usuario',
  add column if not exists debe_cambiar_password boolean not null default false,
  add column if not exists email_verificado_en timestamptz,
  add column if not exists password_actualizado_en timestamptz;

-- Sanity check: rol solo permite valores conocidos.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_rol_check'
  ) then
    alter table public.users
      add constraint users_rol_check
      check (rol in ('usuario', 'admin'));
  end if;
end $$;

-- ── Tokens de verificación de email ─────────────────────────────────────────
-- Un token vive una sola vez: cuando se usa (o expira) ya no sirve.
-- Se guarda el hash del token, no el token en claro, para que un dump de la
-- BD no entregue llaves activas.

create table if not exists public.tokens_verificacion (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists idx_tokens_verificacion_usuario
  on public.tokens_verificacion (usuario_id, creado_en desc);

-- ── Tokens de reset de password ─────────────────────────────────────────────

create table if not exists public.tokens_reset_password (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists idx_tokens_reset_usuario
  on public.tokens_reset_password (usuario_id, creado_en desc);

-- ── Auditoría ───────────────────────────────────────────────────────────────
-- Eventos: login_ok, login_fallo, logout, registro, verificacion_email,
--          cambio_password, reset_password, eliminacion_cuenta, logout_all.
-- `detalles` es jsonb libre (puede llevar IP, user-agent, endpoint, etc.).

create table if not exists public.auditoria (
  id bigserial primary key,
  usuario_id uuid references public.users(id) on delete set null,
  email_intento text,
  accion varchar(40) not null,
  detalles jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_auditoria_usuario_fecha
  on public.auditoria (usuario_id, creado_en desc);

create index if not exists idx_auditoria_accion
  on public.auditoria (accion, creado_en desc);

-- ── Backfill de columnas que ya quisimos en el esquema base ─────────────────
-- (por si la migración corre antes de que se haya añadido esto a la tabla)

alter table public.users
  add column if not exists password_actualizado_en timestamptz;
