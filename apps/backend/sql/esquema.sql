-- Juanpa Finanzas — esquema del backend NestJS.
--
-- Adaptación del esquema original de Supabase (ver infra/supabase/esquema.sql)
-- para correr en un Postgres "pelón" administrado por la propia API:
--
--   · `auth.users` ya no existe: ahora hay una tabla `public.users` propia,
--     mantenida por el backend (bcrypt + JWT, sin magic link).
--   · Se elimina Row Level Security. El aislamiento entre usuarios se aplica
--     en la capa de servicio (AuthCrudService) con `userId` extraído del JWT.
--   · El trigger `preparar_usuario` se dispara al insertar en `public.users`
--     y crea la fila de `ajustes` + las categorías de sistema iniciales.
--
-- Convenciones heredadas del dominio (src/dominio/tipos.ts), que NO cambian:
--   · Montos en centavos como bigint. $1,234.56 → 123456. Nunca numeric/float.
--   · Fechas como text 'YYYY-MM-DD' y periodos 'YYYY-MM' (la lógica de
--     src/dominio/fechas.ts compara cadenas y no gana nada migrándolas a date).
--
-- Convenciones del backend NestJS:
--   · snake_case en columnas (TypeORM hace el mapeo a camelCase en TS).
--   · uuids v4 para todas las PK.

-- ── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Usuarios ────────────────────────────────────────────────────────────────
-- La API la llena al registrarse. password_hash es bcrypt(rounds=12).

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Tablas de dominio ───────────────────────────────────────────────────────

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  icono text not null,
  color text not null,
  es_sistema boolean not null default false,
  archivada boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto bigint not null check (monto >= 0),
  categoria_id uuid not null,
  fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  metodo_pago text not null
    check (metodo_pago in ('efectivo', 'debito', 'credito', 'transferencia', 'otro')),
  nota text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- null es el presupuesto global del mes.
  categoria_id uuid,
  monto_limite bigint not null check (monto_limite >= 0),
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  acreedor text not null,
  monto_original bigint not null check (monto_original >= 0),
  saldo_actual bigint not null,
  -- Porcentaje anual. null cuando no aplica o no se conoce.
  tasa_interes numeric(6, 2),
  fecha_limite text not null check (fecha_limite ~ '^\d{4}-\d{2}-\d{2}$'),
  periodicidad text not null
    check (periodicidad in ('semanal', 'quincenal', 'mensual', 'unico')),
  pago_minimo bigint not null default 0 check (pago_minimo >= 0),
  liquidada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.pagos_deuda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  deuda_id uuid not null references public.deudas(id) on delete cascade,
  monto bigint not null check (monto >= 0),
  fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  nota text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  nombre text not null,
  monto_objetivo bigint not null check (monto_objetivo >= 0),
  monto_actual bigint not null default 0,
  fecha_limite text not null check (fecha_limite ~ '^\d{4}-\d{2}-\d{2}$'),
  prioridad integer not null default 1,
  aporte_mensual bigint not null default 0 check (aporte_mensual >= 0),
  icono text not null default 'Target',
  completada boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.aportes_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  meta_id uuid not null references public.metas(id) on delete cascade,
  monto bigint not null check (monto >= 0),
  fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  nota text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una fila por usuario: la clave primaria es el propio user_id.
create table if not exists public.ajustes (
  user_id uuid primary key references public.users(id) on delete cascade,
  moneda text not null default 'MXN',
  locale text not null default 'es-MX',
  ingreso_mensual bigint not null default 0,
  ciclo_pago text not null default 'quincenal'
    check (ciclo_pago in ('mensual', 'quincenal', 'semanal')),
  saldo_inicial bigint not null default 0,
  saldo_inicial_fecha text not null default '',
  tema text not null default 'sistema' check (tema in ('claro', 'oscuro', 'sistema')),
  acento text not null default 'azul',
  dias_aviso_vencimiento integer not null default 7,
  umbral_precaucion numeric(3, 2) not null default 0.80,
  notificaciones_activas boolean not null default false,
  ultima_revision_vencimientos text not null default '',
  actualizado_en timestamptz not null default now()
);

-- Suscripciones de push, una por dispositivo. La usará la fase 5.
create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);

-- ── Índices ─────────────────────────────────────────────────────────────────
-- Toda consulta filtra por user_id, así que va primero en cada índice.

create index if not exists idx_transacciones_usuario_fecha
  on public.transacciones (user_id, fecha desc);
create index if not exists idx_transacciones_usuario_categoria
  on public.transacciones (user_id, categoria_id);
create index if not exists idx_presupuestos_usuario_periodo
  on public.presupuestos (user_id, periodo);
create index if not exists idx_deudas_usuario
  on public.deudas (user_id, liquidada, fecha_limite);
create index if not exists idx_pagos_usuario_deuda
  on public.pagos_deuda (user_id, deuda_id, fecha desc);
create index if not exists idx_metas_usuario
  on public.metas (user_id, completada, prioridad);
create index if not exists idx_aportes_usuario_meta
  on public.aportes_meta (user_id, meta_id, fecha desc);
create index if not exists idx_categorias_usuario_orden
  on public.categorias (user_id, orden);

-- ── Alta de usuario ─────────────────────────────────────────────────────────
--
-- Al registrarse, cada quien recibe su fila de ajustes y sus categorías
-- iniciales. Hacerlo en la base y no en el cliente evita que una cuenta quede
-- a medio crear si la app se cierra entre el registro y la primera escritura.
--
-- El backend emite el INSERT en public.users; este trigger hace el resto.

create or replace function public.preparar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ajustes (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.categorias (id, user_id, nombre, tipo, icono, color, es_sistema, orden)
  values
    (gen_random_uuid(), new.id, 'Comida',          'egreso',  'Utensils',       '#BC670D', true,  0),
    (gen_random_uuid(), new.id, 'Súper',           'egreso',  'ShoppingCart',   '#90790C', true,  1),
    (gen_random_uuid(), new.id, 'Transporte',      'egreso',  'Car',            '#0F84D8', true,  2),
    (gen_random_uuid(), new.id, 'Renta',           'egreso',  'House',          '#7968EB', true,  3),
    (gen_random_uuid(), new.id, 'Servicios',       'egreso',  'Zap',            '#139EA0', true,  4),
    (gen_random_uuid(), new.id, 'Entretenimiento', 'egreso',  'Clapperboard',   '#C149AC', true,  5),
    (gen_random_uuid(), new.id, 'Salud',           'egreso',  'HeartPulse',     '#10924B', true,  6),
    (gen_random_uuid(), new.id, 'Educación',       'egreso',  'GraduationCap',  '#0F84D8', true,  7),
    (gen_random_uuid(), new.id, 'Compras',         'egreso',  'ShoppingBag',    '#E2484F', true,  8),
    (gen_random_uuid(), new.id, 'Suscripciones',   'egreso',  'Repeat',         '#10924B', true,  9),
    (gen_random_uuid(), new.id, 'Mascotas',        'egreso',  'PawPrint',       '#C149AC', true, 10),
    (gen_random_uuid(), new.id, 'Otros gastos',    'egreso',  'Ellipsis',       '#90790C', true, 11),
    (gen_random_uuid(), new.id, 'Sueldo',          'ingreso', 'Briefcase',      '#10924B', true, 12),
    (gen_random_uuid(), new.id, 'Freelance',       'ingreso', 'Laptop',         '#139EA0', true, 13),
    (gen_random_uuid(), new.id, 'Ventas',          'ingreso', 'Store',          '#90790C', true, 14),
    (gen_random_uuid(), new.id, 'Regalos',         'ingreso', 'Gift',           '#C149AC', true, 15),
    (gen_random_uuid(), new.id, 'Otros ingresos',  'ingreso', 'Ellipsis',       '#0F84D8', true, 16);

  return new;
end $$;

drop trigger if exists al_crear_usuario on public.users;
create trigger al_crear_usuario
  after insert on public.users
  for each row execute function public.preparar_usuario();
