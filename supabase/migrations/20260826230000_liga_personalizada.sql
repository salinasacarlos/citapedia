-- La liga la abre una persona con nombre, no "el paciente".
--
-- Cuando la cita es de un menor, quien la abre es su tutor: saludarlo a él y
-- decir de quién es la cita son dos datos distintos, y confundirlos es el mismo
-- enredo que `is_minor` vino a resolver. Por eso `ver_cita` devuelve los dos
-- por separado, en vez de que la página adivine con el nombre que ya tenía.

drop function if exists public.ver_cita(text);

create or replace function public.ver_cita(p_token text)
returns table (
  cita_id          uuid,
  consultorio      text,
  slug             text,
  direccion        text,
  telefono         text,
  zona             text,
  paciente         text,
  es_menor         boolean,
  tutor            text,
  inicio           timestamptz,
  fin              timestamptz,
  estado           public.appointment_status,
  confirmada_por_paciente boolean,
  ya_declaro       boolean,
  puede_reagendar  boolean,
  duracion_min     int
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.name, p.slug, p.clinic_address, p.phone, p.timezone,
         pa.name,
         coalesce(pa.is_minor, false),
         -- Solo el del tutor de verdad: un `tutor_name` suelto en un paciente
         -- adulto no convierte a nadie en su encargado.
         case when pa.is_minor then pa.tutor_name end,
         c.starts_at, c.ends_at, c.status,
         c.patient_confirmed_at is not null,
         exists (select 1 from public.declared_records d where d.patient_id = pa.id),
         c.status = 'confirmed'
           and c.starts_at >= now() + (public.horas_minimas_para_reagendar() || ' hours')::interval,
         (extract(epoch from (c.ends_at - c.starts_at)) / 60)::int
    from public.appointments c
    join public.professionals p on p.id = c.professional_id
    left join public.patients pa on pa.id = c.patient_id
   where c.access_token = p_token;
$$;

comment on function public.ver_cita(text) is
  'Lo que ve quien abre la liga de una cita. Identifica por token, nunca por sesión.';

grant execute on function public.ver_cita(text) to anon, authenticated;
