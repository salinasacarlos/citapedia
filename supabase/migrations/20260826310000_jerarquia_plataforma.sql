-- CitaPedia — jerarquía de la plataforma.
--
-- Ya había dos escalas separadas y sin relación entre sí:
--
--   Dentro de un consultorio   memberships.role: owner | assistant
--   Sobre la plataforma        platform_admins
--
-- Ser dueño de un consultorio no da nada aquí, y ser operador no mete a nadie
-- en ningún consultorio. Lo que faltaba era escala DENTRO de la plataforma:
-- quien contesta soporte no tiene por qué poder apagarle el negocio a nadie.

create type public.platform_role as enum ('fundador', 'soporte');

alter table public.platform_admins
  add column role public.platform_role not null default 'soporte';

-- Los que ya estaban son fundadores: no había otra cosa que ser.
update public.platform_admins set role = 'fundador';

comment on column public.platform_admins.role is
  'fundador: ve y opera (suspende, reactiva, da de alta). '
  'soporte: solo ve. La consola nunca muestra datos clínicos para ninguno.';

-- `es_superadmin` sigue significando "puede entrar a la consola".
-- Para cambiar algo hace falta más que entrar.
create or replace function public.es_operador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a
     where a.user_id = (select auth.uid()) and a.role = 'fundador'
  );
$$;

grant execute on function public.es_operador() to authenticated;

-- Las tres que cambian algo pasan de "puede entrar" a "puede operar".
create or replace function public.plataforma_suspender(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_operador() then
    raise exception 'Soporte puede ver, no suspender.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe por qué se suspende.' using errcode = 'check_violation';
  end if;

  update public.professionals
     set suspended_at = now(), suspended_reason = trim(p_motivo)
   where id = p_id;

  insert into public.platform_audit (actor_id, action, target_id, detail)
  values ((select auth.uid()), 'suspender', p_id, trim(p_motivo));
end;
$$;

create or replace function public.plataforma_reactivar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_operador() then
    raise exception 'Soporte puede ver, no reactivar.' using errcode = 'insufficient_privilege';
  end if;

  update public.professionals
     set suspended_at = null, suspended_reason = null
   where id = p_id;

  insert into public.platform_audit (actor_id, action, target_id)
  values ((select auth.uid()), 'reactivar', p_id);
end;
$$;

create or replace function public.plataforma_anotar(
  p_action text,
  p_target uuid,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_operador() then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.platform_audit (actor_id, action, target_id, detail)
  values ((select auth.uid()), p_action, p_target, nullif(trim(p_detail), ''));
end;
$$;

-- Quiénes operan. Se ve desde la consola; se cambia desde la consola solo si
-- eres fundador, y el primero de todos sigue naciendo por SQL.
create or replace function public.plataforma_operadores()
returns table (email text, rol public.platform_role, note text, desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, a.role, a.note, a.created_at
    from public.platform_admins a
    join auth.users u on u.id = a.user_id
   where public.es_superadmin()
   order by a.created_at;
$$;

grant execute on function public.plataforma_operadores() to authenticated;

/**
 * Alta de un operador sobre un usuario que YA existe.
 *
 * Se separa de crear la cuenta a propósito: crear usuarios necesita la llave
 * de servicio y vive en el servidor; esto solo reparte permiso, y así el
 * permiso siempre queda anotado aunque la cuenta se haya creado por otro lado.
 */
create or replace function public.plataforma_dar_permiso(
  p_email text,
  p_rol public.platform_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  destino uuid;
begin
  if not public.es_operador() then
    raise exception 'Solo un fundador reparte permisos.' using errcode = 'insufficient_privilege';
  end if;

  select id into destino from auth.users where email = lower(trim(p_email));
  if destino is null then
    raise exception 'No hay ninguna cuenta con ese correo.' using errcode = 'no_data_found';
  end if;

  insert into public.platform_admins (user_id, role, note)
  values (destino, p_rol, 'alta desde la consola')
  on conflict (user_id) do update set role = excluded.role;

  insert into public.platform_audit (actor_id, action, detail)
  values ((select auth.uid()), 'permiso', lower(trim(p_email)) || ' → ' || p_rol);
end;
$$;

create or replace function public.plataforma_quitar_permiso(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  destino uuid;
begin
  if not public.es_operador() then
    raise exception 'Solo un fundador reparte permisos.' using errcode = 'insufficient_privilege';
  end if;

  select id into destino from auth.users where email = lower(trim(p_email));

  -- Quedarse sin fundadores dejaría la plataforma sin quien la opere, y el
  -- arreglo sería entrar a la base a mano.
  if (select count(*) from public.platform_admins where role = 'fundador') <= 1
     and exists (select 1 from public.platform_admins
                  where user_id = destino and role = 'fundador') then
    raise exception 'Es el único fundador: da de alta a otro antes de quitarlo.'
      using errcode = 'check_violation';
  end if;

  delete from public.platform_admins where user_id = destino;

  insert into public.platform_audit (actor_id, action, detail)
  values ((select auth.uid()), 'permiso-quitado', lower(trim(p_email)));
end;
$$;

grant execute on function public.plataforma_dar_permiso(text, public.platform_role) to authenticated;
grant execute on function public.plataforma_quitar_permiso(text) to authenticated;
