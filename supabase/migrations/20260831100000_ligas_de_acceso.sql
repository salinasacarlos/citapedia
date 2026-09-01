-- La liga de acceso deja de ser la de Supabase.
--
-- La de Supabase se quema al ABRIRLA: quien la abría, miraba la pantalla y se
-- iba a buscar una contraseña que le gustara, volvía a una liga muerta sin
-- haber cambiado nada. Y vence en una hora, que no alcanza cuando se manda por
-- WhatsApp a alguien que está en consulta.
--
-- Esta liga es nuestra, así que decidimos cuándo muere: aguanta 48 horas, se
-- puede abrir las veces que haga falta, y se marca usada cuando de verdad se
-- puso la contraseña. La sesión de Supabase se arma en el momento de abrirla,
-- desde el servidor, con un token de un solo uso que nadie más ve.

create table public.access_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  token       text unique not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index access_grants_user_id_idx on public.access_grants (user_id);

alter table public.access_grants enable row level security;

-- Sin políticas, a propósito: la tabla guarda credenciales de entrada y no
-- tiene por qué ser legible desde la API con ninguna llave. Solo la toca el
-- servidor con la llave de servicio, igual que `platform_admins`.

comment on table public.access_grants is
  'Ligas para que alguien ponga su contraseña por primera vez. La liga es la '
  'credencial: vive 48 horas, se puede abrir varias veces y muere al usarse.';

comment on column public.access_grants.used_at is
  'Cuándo se puso la contraseña. Abrir la liga NO la marca: quien la abre y se '
  'va a pensar su contraseña tiene que poder volver.';

-- Quién es, dentro de este consultorio, el dueño de ese correo.
--
-- Devuelve el id solo si esa dirección es de alguien del equipo: es la misma
-- validación que ya hacía la acción, pero en la base, que es donde no se puede
-- olvidar. Sin ella, la consola armaría una liga de entrada para cualquier
-- dirección que le dictaran.
create or replace function public.plataforma_usuario_del_equipo(
  p_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.es_operador() then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
  end if;

  select u.id into v_user
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where m.professional_id = p_id
     and lower(u.email) = lower(trim(p_email))
   limit 1;

  return v_user;
end;
$$;

revoke execute on function public.plataforma_usuario_del_equipo(uuid, text) from public, anon;
grant execute on function public.plataforma_usuario_del_equipo(uuid, text) to authenticated;
