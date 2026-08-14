-- Migración 2026-08-14: features que faltan del checklist
--
--  · gastos_recurrentes: plantillas que generan transacciones automáticas
--  · users: idioma preferente + opt-in/opt-out del digest semanal

-- ── Gastos recurrentes ────────────────────────────────────────────────────
-- Una fila = una plantilla (Netflix 250 cada mes día 15). El backend
-- evalúa las plantillas al login y crea las transacciones que tocan
-- en el periodo actual. La marca `ultimo_generado_en` evita duplicar.

create table if not exists public.gastos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto bigint not null check (monto >= 0),
  categoria_id uuid not null references public.categorias(id) on delete restrict,
  metodo_pago text not null
    check (metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'otro')),
  nota text not null default '',
  -- día del mes en que se genera (1-28; tope en 28 para evitar líos con feb)
  dia_del_mes integer not null check (dia_del_mes between 1 and 28),
  -- cuando arranca y cuando termina (null = sin fin)
  inicia_en text not null check (inicia_en ~ '^\d{4}-\d{2}-\d{2}$'),
  termina_en text check (termina_en ~ '^\d{4}-\d{2}-\d{2}$'),
  activo boolean not null default true,
  ultimo_generado_en text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_recurrentes_usuario_activo
  on public.gastos_recurrentes (user_id, activo);

-- ── Preferencias de usuario (idioma, digest) ─────────────────────────────

alter table public.users
  add column if not exists idioma varchar(5) not null default 'es';
alter table public.users
  add column if not exists recibir_digest boolean not null default true;
alter table public.users
  add column if not exists ultimo_digest_en timestamptz;
