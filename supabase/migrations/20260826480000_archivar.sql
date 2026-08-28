-- NOM-004: el expediente se conserva cinco años. Nada se borra de verdad.
--
-- `eliminarConsultorio` hacía `delete from professionals`, y la cascada se
-- llevaba pacientes, citas, expedientes, notas, estudios y hasta el historial
-- de cambios que se agregó para cumplir la norma. Un clic y cinco años de
-- expedientes desaparecían.
--
-- Archivar en vez de borrar. Para el médico el efecto es el mismo —su cuenta
-- deja de funcionar y su página deja de existir—, pero los datos siguen ahí
-- por si alguien los reclama: un paciente que pide su expediente, una queja,
-- una autoridad.
--
-- `archived_at` es además la fecha desde la que corren los cinco años.

alter table public.professionals
  add column archived_at     timestamptz,
  add column archived_reason text;

comment on column public.professionals.archived_at is
  'Cuándo se archivó el consultorio. Los datos se conservan: la norma pide '
  'cinco años, y esta fecha es desde cuándo se cuentan.';

-- Un estudio borrado tampoco se va: es tan del expediente como una nota, y las
-- notas ya guardan su versión anterior.
alter table public.consultation_files
  add column archived_at timestamptz;

-- ------------------------------------------------- lo que apaga archivar

-- La página pública deja de existir, igual que con una suspensión.
create or replace view public.public_professionals
with (security_invoker = false) as
  select id, name, slug, specialty, bio, photo_url, theme,
         consultation_info, clinic_address, phone, slot_duration, timezone
    from public.professionals
   where suspended_at is null and archived_at is null;

-- Y deja de recibir citas. Se amplía el trigger que ya existía para las
-- suspensiones: son dos motivos distintos con el mismo efecto.
create or replace function public.consultorio_activo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pro record;
begin
  select suspended_at, archived_at into pro
    from public.professionals where id = new.professional_id;

  if pro.archived_at is not null then
    raise exception 'Este consultorio ya no está en servicio.'
      using errcode = 'check_violation';
  end if;
  if pro.suspended_at is not null then
    raise exception 'Este consultorio no está recibiendo citas por ahora.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

/**
 * Archiva el consultorio. Reemplaza al borrado.
 *
 * Solo el dueño, y solo el suyo: RLS ya lo garantiza, pero al ser la operación
 * más destructiva que ofrece la aplicación conviene que también lo diga la
 * función.
 */
create or replace function public.archivar_consultorio(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_owner(p_id) then
    raise exception 'Solo el dueño puede archivar su consultorio.'
      using errcode = 'insufficient_privilege';
  end if;

  update professionals
     set archived_at = now(), archived_reason = nullif(trim(p_motivo), '')
   where id = p_id;
end;
$$;

grant execute on function public.archivar_consultorio(uuid, text) to authenticated;

-- La consola de plataforma tiene que verlos: un consultorio archivado sigue
-- teniendo datos que alguien puede reclamar.
drop function if exists public.plataforma_consultorios();

create or replace function public.plataforma_consultorios()
returns table (
  id               uuid,
  name             text,
  slug             text,
  specialty        text,
  email            text,
  created_at       timestamptz,
  suspended_at     timestamptz,
  suspended_reason text,
  archived_at      timestamptz,
  miembros         int,
  pacientes        int,
  citas            int,
  citas_30d        int,
  ultima_cita      timestamptz,
  ultimo_ingreso   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with citas as (
    select c.professional_id,
           count(*)::int as total,
           count(*) filter (where c.created_at > now() - interval '30 days')::int as recientes,
           max(c.starts_at) as ultima
      from public.appointments c
     group by c.professional_id
  ),
  pacientes as (
    select pa.professional_id, count(*)::int as total
      from public.patients pa
     group by pa.professional_id
  ),
  equipo as (
    select m.professional_id,
           count(*)::int as total,
           max(u.last_sign_in_at) as ultimo_ingreso
      from public.memberships m
      join auth.users u on u.id = m.user_id
     group by m.professional_id
  )
  select p.id, p.name, p.slug, p.specialty, p.email, p.created_at,
         p.suspended_at, p.suspended_reason, p.archived_at,
         coalesce(e.total, 0), coalesce(pa.total, 0),
         coalesce(c.total, 0), coalesce(c.recientes, 0),
         c.ultima, e.ultimo_ingreso
    from public.professionals p
    left join citas c on c.professional_id = p.id
    left join pacientes pa on pa.professional_id = p.id
    left join equipo e on e.professional_id = p.id
   where public.es_superadmin()
   order by p.archived_at nulls first, p.created_at desc;
$$;

grant execute on function public.plataforma_consultorios() to authenticated;
