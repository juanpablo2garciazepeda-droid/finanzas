-- Juanpa Finanzas — esquema y aislamiento entre usuarios.
--
-- Convenciones heredadas de src/dominio/tipos.ts, que NO se cambian:
--   · Los montos son enteros en centavos. $1,234.56 se guarda como 123456.
--     Se usa bigint, nunca numeric ni float: un flotante en dinero es un error
--     de redondeo esperando su turno.
--   · Las fechas del dominio son texto 'YYYY-MM-DD' y los periodos 'YYYY-MM'.
--     Se dejan como text con restricción: la lógica de src/dominio/fechas.ts
--     compara cadenas y funciona bien así. Convertirlas a date obligaría a
--     reescribirla sin ganar nada.
--
-- El aislamiento lo garantiza la base, no el frontend. Si la aplicación tiene
-- un bug, un usuario sigue sin poder leer los datos de otro.

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table if not exists public.categorias (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  icono text not null,
  color text not null,
  es_sistema boolean not null default false,
  archivada boolean not null default false,
  orden integer not null default 0,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.transacciones (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- null es el presupuesto global del mes.
  categoria_id uuid,
  monto_limite bigint not null check (monto_limite >= 0),
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.deudas (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deuda_id uuid not null references public.deudas(id) on delete cascade,
  monto bigint not null check (monto >= 0),
  fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  nota text not null default '',
  actualizado_en timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meta_id uuid not null references public.metas(id) on delete cascade,
  monto bigint not null check (monto >= 0),
  fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  nota text not null default '',
  actualizado_en timestamptz not null default now()
);

-- Una fila por usuario: la clave primaria es el propio user_id.
create table if not exists public.ajustes (
  user_id uuid primary key references auth.users(id) on delete cascade,
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

-- Suscripciones de push, una por dispositivo. La usa la fase 5.
create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- ── Aislamiento entre usuarios ──────────────────────────────────────────────
--
-- `using` decide qué filas se pueden leer; `with check`, qué filas se pueden
-- escribir. Hacen falta las dos: sin `with check`, cualquiera podría insertar
-- filas a nombre de otra persona.
--
-- Sin RLS activo, la llave anónima que vive en el frontend leería la tabla
-- entera. Activarlo no es opcional.

do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'transacciones', 'presupuestos', 'deudas',
    'pagos_deuda', 'metas', 'aportes_meta', 'ajustes', 'suscripciones_push'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "cada quien ve lo suyo" on public.%I', t);
    execute format(
      'create policy "cada quien ve lo suyo" on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ── Alta de usuario ─────────────────────────────────────────────────────────
--
-- Al registrarse, cada quien recibe su fila de ajustes y sus categorías
-- iniciales. Hacerlo en la base y no en el cliente evita que una cuenta quede a
-- medio crear si la app se cierra entre el registro y la primera escritura.

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
    (gen_random_uuid(), new.id, 'Comida',        'egreso',  'Utensils',   '#BC670D', true, 0),
    (gen_random_uuid(), new.id, 'Transporte',    'egreso',  'Car',        '#0071E3', true, 1),
    (gen_random_uuid(), new.id, 'Renta',         'egreso',  'House',      '#7968EB', true, 2),
    (gen_random_uuid(), new.id, 'Servicios',     'egreso',  'Zap',        '#B25000', true, 3),
    (gen_random_uuid(), new.id, 'Salud',         'egreso',  'HeartPulse', '#D70015', true, 4),
    (gen_random_uuid(), new.id, 'Suscripciones', 'egreso',  'Repeat',     '#C9186B', true, 5),
    (gen_random_uuid(), new.id, 'Sueldo',        'ingreso', 'Briefcase',  '#10924B', true, 6);

  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.preparar_usuario();
