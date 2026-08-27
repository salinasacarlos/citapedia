-- CitaPedia — lo que la plataforma puede ver y hacer.
--
-- Cada función revisa `es_superadmin()` en su primera línea. Ninguna toca
-- tablas clínicas: operar la plataforma no necesita el expediente de nadie.

-- Una cuenta suspendida no puede recibir citas nuevas. La página pública ya
-- desapareció con la vista, pero `solicitar_cita` es SECURITY DEFINER y lee
-- `professionals` directo: sin esto, una liga vieja seguiría agendando.
create or replace function public.consultorio_activo()
returns trigger
language plpgsql
as $$
declare
  suspendido timestamptz;
begin
  select suspended_at into suspendido
    from public.professionals where id = new.professional_id;

  if suspendido is not null then
    raise exception 'Este consultorio no está recibiendo citas por ahora.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_consultorio_activo on public.appointments;
create trigger appointments_consultorio_activo
  before insert on public.appointments
  for each row execute function public.consultorio_activo();

-- ------------------------------------------------------------- la lista

create or replace function public.plataforma_consultorios()
returns table (
  id              uuid,
  name            text,
  slug            text,
  specialty       text,
  email           text,
  created_at      timestamptz,
  suspended_at    timestamptz,
  suspended_reason text,
  miembros        int,
  pacientes       int,
  citas           int,
  citas_30d       int,
  ultima_cita     timestamptz,
  ultimo_ingreso  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.slug, p.specialty, p.email, p.created_at,
         p.suspended_at, p.suspended_reason,
         (select count(*)::int from public.memberships m where m.professional_id = p.id),
         (select count(*)::int from public.patients pa where pa.professional_id = p.id),
         (select count(*)::int from public.appointments c where c.professional_id = p.id),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id and c.created_at > now() - interval '30 days'),
         (select max(c.starts_at) from public.appointments c where c.professional_id = p.id),
         (select max(u.last_sign_in_at) from public.memberships m
            join auth.users u on u.id = m.user_id
           where m.professional_id = p.id)
    from public.professionals p
   where public.es_superadmin()
   order by p.created_at desc;
$$;

grant execute on function public.plataforma_consultorios() to authenticated;

-- ------------------------------------------------------------- el resumen

create or replace function public.plataforma_resumen()
returns table (
  consultorios       int,
  activos            int,
  suspendidos        int,
  altas_30d          int,
  pacientes          int,
  citas              int,
  citas_30d          int,
  solicitudes_abiertas int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.professionals),
    (select count(*)::int from public.professionals where suspended_at is null),
    (select count(*)::int from public.professionals where suspended_at is not null),
    (select count(*)::int from public.professionals
      where created_at > now() - interval '30 days'),
    (select count(*)::int from public.patients),
    (select count(*)::int from public.appointments),
    (select count(*)::int from public.appointments
      where created_at > now() - interval '30 days'),
    (select count(*)::int from public.appointments
      where status = 'requested' and starts_at >= now())
  where public.es_superadmin();
$$;

grant execute on function public.plataforma_resumen() to authenticated;

-- --------------------------------------------------- suspender y reactivar

create or replace function public.plataforma_suspender(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
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
  if not public.es_superadmin() then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
  end if;

  update public.professionals
     set suspended_at = null, suspended_reason = null
   where id = p_id;

  insert into public.platform_audit (actor_id, action, target_id)
  values ((select auth.uid()), 'reactivar', p_id);
end;
$$;

grant execute on function public.plataforma_suspender(uuid, text) to authenticated;
grant execute on function public.plataforma_reactivar(uuid) to authenticated;

-- ------------------------------------------------------------- la bitácora

create or replace function public.plataforma_bitacora(p_limite int default 50)
returns table (
  created_at timestamptz,
  action     text,
  detail     text,
  target     text,
  actor      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.created_at, a.action, a.detail, p.name, u.email::text
    from public.platform_audit a
    left join public.professionals p on p.id = a.target_id
    left join auth.users u on u.id = a.actor_id
   where public.es_superadmin()
   order by a.created_at desc
   limit least(coalesce(p_limite, 50), 200);
$$;

grant execute on function public.plataforma_bitacora(int) to authenticated;
