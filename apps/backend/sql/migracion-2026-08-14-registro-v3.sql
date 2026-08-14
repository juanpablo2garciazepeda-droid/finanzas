-- Migración 2026-08-14: registro guiado con foto y código de verificación
--
--  · users.foto_url        — foto de perfil como data URL (image/jpeg base64).
--    Se guarda en la propia fila y no en un bucket porque la app se despliega
--    como dos contenedores sin almacenamiento de objetos, y el cliente ya
--    recorta y reescala a 256×256 antes de subir: son decenas de KB, no MB.
--    El backend igual impone un tope duro (ver LARGO_MAX_FOTO en auth.dto.ts).
--
--  · tokens_verificacion.codigo_hash — código de 6 dígitos que el usuario
--    teclea, como alternativa al enlace. El enlace sigue funcionando: quien
--    abre el correo en el mismo aparato pica, y quien lo abre en otro teclea.
--    Se guarda hasheado por la misma razón que el token: un dump de la BD no
--    debe entregar cuentas activables.
--
--  · tokens_verificacion.intentos — cuántas veces se ha tecleado mal. Un
--    código de 6 dígitos son un millón de combinaciones; sin un tope, un bot
--    las recorre. A los 6 fallos el código muere y hay que pedir otro.

alter table public.users
  add column if not exists foto_url text;

alter table public.tokens_verificacion
  add column if not exists codigo_hash text,
  add column if not exists intentos integer not null default 0;

-- Búsqueda por usuario al canjear un código: se toma el más reciente vivo.
create index if not exists idx_tokens_verificacion_usuario_vivo
  on public.tokens_verificacion (usuario_id, usado_en, expira_en desc);
