-- Auditoría: dos consultas que crecen con los datos.
--
-- 1. **"De dónde llegan"** traía TODOS los pacientes a la aplicación para
--    contarlos en JavaScript. Con veinte pacientes no se nota; con cinco mil
--    son cinco mil renglones viajando en cada carga de Inicio, para acabar
--    mostrando ocho números. Contar es trabajo de la base.
--
-- 2. **La lista de la consola** hacía seis subconsultas correlacionadas por
--    cada consultorio. Con cuatro consultorios son 24 consultas; con mil son
--    seis mil. Se cambia por agregados que recorren cada tabla una vez.

create or replace function public.origenes_consultorio()
returns table (source text, cuantos int)
language sql
stable
security invoker
set search_path = public
as $$
  select p.source, count(*)::int
    from patients p
   where p.source is not null
   group by p.source
   order by count(*) desc;
$$;

/**
 * Quién manda pacientes. Solo los que mandaron a alguien de verdad, ordenados
 * por cuántos: es la lista de a quién agradecerle.
 */
create or replace function public.recomendantes_consultorio(p_limite int default 5)
returns table (quien text, cuantos int)
language sql
stable
security invoker
set search_path = public
as $$
  select trim(p.referred_by), count(*)::int
    from patients p
   where p.referred_by is not null and trim(p.referred_by) <> ''
   group by trim(p.referred_by)
   order by count(*) desc, trim(p.referred_by)
   limit least(greatest(coalesce(p_limite, 5), 1), 50);
$$;

/** Cuántos contestaron de dónde vienen, para saber si el corte es confiable. */
create or replace function public.cobertura_origen()
returns table (con_origen int, total int)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*) filter (where source is not null)::int, count(*)::int from patients;
$$;

grant execute on function public.origenes_consultorio() to authenticated;
grant execute on function public.recomendantes_consultorio(int) to authenticated;
grant execute on function public.cobertura_origen() to authenticated;

-- --------------------------------------------- la lista de la consola

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
         p.suspended_at, p.suspended_reason,
         coalesce(e.total, 0), coalesce(pa.total, 0),
         coalesce(c.total, 0), coalesce(c.recientes, 0),
         c.ultima, e.ultimo_ingreso
    from public.professionals p
    left join citas c on c.professional_id = p.id
    left join pacientes pa on pa.professional_id = p.id
    left join equipo e on e.professional_id = p.id
   where public.es_superadmin()
   order by p.created_at desc;
$$;

grant execute on function public.plataforma_consultorios() to authenticated;
