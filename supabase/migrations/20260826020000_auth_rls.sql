-- CitaPedia — auth y RLS
--
-- Dos accesos distintos a los mismos datos:
--   · El consultorio (owner + assistants) entra autenticado y ve TODO lo suyo.
--   · El público entra anónimo y ve solo lo que la página pública necesita,
--     a través de vistas curadas. Nunca las tablas base.
--
-- Al registrarse un médico, un trigger sobre auth.users le crea su
-- professional, su membership de owner y sus preferencias de recordatorio.

-- ------------------------------------------------------------------ slugs

create or replace function public.slugify(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(txt,
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9]+', '-', 'g'));
$$;

-- --------------------------------------------------- alta de un consultorio

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidato text;
  n         int := 1;
  pro_id    uuid;
begin
  -- Los asistentes invitados (paso 5) se enganchan a un consultorio que ya
  -- existe; solo damos de alta consultorio a quien se registra como médico.
  if coalesce(new.raw_user_meta_data->>'signup_kind', 'professional') <> 'professional' then
    return new;
  end if;

  base := public.slugify(
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1))
  );
  if coalesce(base, '') = '' then
    base := 'consultorio';
  end if;

  candidato := base;
  while exists (select 1 from public.professionals p where p.slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;

  insert into public.professionals (name, email, specialty, slug)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), new.email),
    new.email,
    nullif(new.raw_user_meta_data->>'specialty', ''),
    candidato
  )
  returning id into pro_id;

  insert into public.memberships (professional_id, user_id, role)
  values (pro_id, new.id, 'owner');

  insert into public.reminder_settings (professional_id)
  values (pro_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------ quién es quién

-- SECURITY DEFINER a propósito: si las políticas de memberships consultaran
-- memberships con RLS puesto, la evaluación se haría recursiva.

create or replace function public.is_member(pro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.professional_id = pro
       and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner(pro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.professional_id = pro
       and m.user_id = (select auth.uid())
       and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------- RLS on

alter table public.professionals     enable row level security;
alter table public.memberships       enable row level security;
alter table public.invitations       enable row level security;
alter table public.availability      enable row level security;
alter table public.time_blocks       enable row level security;
alter table public.patients          enable row level security;
alter table public.appointments      enable row level security;
alter table public.reminder_settings enable row level security;

-- professionals ---------------------------------------------------------
-- El público NO lee esta tabla (trae el email de acceso): usa la vista.
create policy professionals_select_members on public.professionals
  for select to authenticated using (public.is_member(id));

create policy professionals_update_members on public.professionals
  for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- Borrar la cuenta es del owner; el asistente no.
create policy professionals_delete_owner on public.professionals
  for delete to authenticated using (public.is_owner(id));

-- memberships -----------------------------------------------------------
create policy memberships_select_team on public.memberships
  for select to authenticated using (public.is_member(professional_id));

-- El owner puede sacar a un asistente, pero no borrarse a sí mismo.
create policy memberships_delete_owner on public.memberships
  for delete to authenticated
  using (public.is_owner(professional_id) and role = 'assistant');

-- invitations -----------------------------------------------------------
-- Invitar es exclusivo del owner.
create policy invitations_all_owner on public.invitations
  for all to authenticated
  using (public.is_owner(professional_id)) with check (public.is_owner(professional_id));

-- availability ----------------------------------------------------------
create policy availability_all_members on public.availability
  for all to authenticated
  using (public.is_member(professional_id)) with check (public.is_member(professional_id));

-- time_blocks -----------------------------------------------------------
create policy time_blocks_all_members on public.time_blocks
  for all to authenticated
  using (public.is_member(professional_id)) with check (public.is_member(professional_id));

-- appointments ----------------------------------------------------------
create policy appointments_select_members on public.appointments
  for select to authenticated using (public.is_member(professional_id));

create policy appointments_insert_members on public.appointments
  for insert to authenticated with check (public.is_member(professional_id));

create policy appointments_update_members on public.appointments
  for update to authenticated
  using (public.is_member(professional_id)) with check (public.is_member(professional_id));

-- Las citas no se borran, cambian de estado. El owner puede limpiar errores.
create policy appointments_delete_owner on public.appointments
  for delete to authenticated using (public.is_owner(professional_id));

-- patients --------------------------------------------------------------
-- Un paciente es visible para el consultorio que tiene una cita con él.
create policy patients_select_members on public.patients
  for select to authenticated using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = patients.id
         and public.is_member(a.professional_id)
    )
  );

create policy patients_insert_members on public.patients
  for insert to authenticated with check (
    exists (select 1 from public.memberships m where m.user_id = (select auth.uid()))
  );

create policy patients_update_members on public.patients
  for update to authenticated using (
    exists (
      select 1 from public.appointments a
       where a.patient_id = patients.id
         and public.is_member(a.professional_id)
    )
  );

-- reminder_settings -----------------------------------------------------
create policy reminder_settings_all_members on public.reminder_settings
  for all to authenticated
  using (public.is_member(professional_id)) with check (public.is_member(professional_id));

-- ------------------------------------------------- cara pública del médico
--
-- Estas vistas corren con los permisos de su dueño (security_invoker = false),
-- así que atraviesan el RLS de arriba a propósito: son la lista blanca de
-- columnas que el público puede ver. Todo lo demás queda del otro lado.

create view public.public_professionals
with (security_invoker = false) as
  select id, name, slug, specialty, bio, photo_url, theme,
         consultation_info, clinic_address, phone, slot_duration
    from public.professionals;

comment on view public.public_professionals is
  'Perfil público del médico. Excluye a propósito el email de acceso.';

create view public.public_availability
with (security_invoker = false) as
  select id, professional_id, weekday, start_time, end_time
    from public.availability;

-- Sin `reason`: el público necesita saber que el hueco está tapado,
-- no por qué.
create view public.public_time_blocks
with (security_invoker = false) as
  select id, professional_id, starts_at, ends_at
    from public.time_blocks;

-- Horas ya tomadas, sin decir por quién ni por qué. Solo las confirmadas
-- ocupan agenda: una solicitud pendiente no bloquea el hueco.
create view public.public_busy_slots
with (security_invoker = false) as
  select professional_id, starts_at, ends_at
    from public.appointments
   where status = 'confirmed';

grant select on public.public_professionals to anon, authenticated;
grant select on public.public_availability  to anon, authenticated;
grant select on public.public_time_blocks   to anon, authenticated;
grant select on public.public_busy_slots    to anon, authenticated;
