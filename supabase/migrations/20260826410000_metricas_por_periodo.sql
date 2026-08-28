-- Las métricas aceptan un periodo.
--
-- Ojo con la trampa que ya costó una vez en `solicitar_cita`: `create or
-- replace function` con distinta cantidad de parámetros **no reemplaza, crea
-- una sobrecarga**, y entonces la llamada sin argumentos se vuelve ambigua
-- porque las dos firmas encajan. Se borra la anterior antes de crear la nueva.
--
-- Lo que NO se parametriza es "ahora mismo": por revisar, por cerrar, las
-- citas de esta semana y la ocupación son del presente por definición.
-- Filtrarlas por un periodo pasado daría números que no piden ninguna acción.

drop function if exists public.metricas_consultorio();

create or replace function public.metricas_consultorio(
  p_desde timestamptz default null,
  p_hasta timestamptz default null
)
returns table (
  pacientes            int,
  pacientes_periodo    int,
  por_revisar          int,
  por_cerrar           int,
  proximas_7d          int,
  sin_confirmar_7d     int,
  atendidas            int,
  inasistencias        int,
  canceladas           int,
  agendadas            int,
  cerradas_con_confirmacion   int,
  faltaron_con_confirmacion   int,
  cerradas_sin_confirmacion   int,
  faltaron_sin_confirmacion   int,
  minutos_semana       int,
  minutos_agendados_7d int
)
language sql
stable
security invoker
set search_path = public
as $$
  with rango as (
    select coalesce(p_desde, now() - interval '30 days') as desde,
           coalesce(p_hasta, now()) as hasta
  )
  select
    (select count(*)::int from patients),
    (select count(*)::int from patients, rango
      where patients.created_at between rango.desde and rango.hasta),

    (select count(*)::int from appointments
      where status = 'requested' and starts_at >= now()),
    (select count(*)::int from appointments
      where status = 'confirmed' and ends_at < now()),
    (select count(*)::int from appointments
      where status = 'confirmed' and starts_at between now() and now() + interval '7 days'),
    (select count(*)::int from appointments
      where status = 'confirmed' and patient_confirmed_at is null
        and starts_at between now() and now() + interval '7 days'),

    (select count(*)::int from appointments, rango
      where status = 'completed' and starts_at between rango.desde and rango.hasta),
    (select count(*)::int from appointments, rango
      where status = 'no_show' and starts_at between rango.desde and rango.hasta),
    (select count(*)::int from appointments, rango
      where status in ('cancelled_by_patient', 'cancelled_by_professional')
        and starts_at between rango.desde and rango.hasta),
    -- Todo lo que se apartó en el periodo, sin importar en qué terminó.
    (select count(*)::int from appointments, rango
      where starts_at between rango.desde and rango.hasta),

    (select count(*)::int from appointments, rango
      where status in ('completed', 'no_show') and patient_confirmed_at is not null
        and starts_at between rango.desde and rango.hasta),
    (select count(*)::int from appointments, rango
      where status = 'no_show' and patient_confirmed_at is not null
        and starts_at between rango.desde and rango.hasta),
    (select count(*)::int from appointments, rango
      where status in ('completed', 'no_show') and patient_confirmed_at is null
        and starts_at between rango.desde and rango.hasta),
    (select count(*)::int from appointments, rango
      where status = 'no_show' and patient_confirmed_at is null
        and starts_at between rango.desde and rango.hasta),

    (select coalesce(sum(extract(epoch from (end_time - start_time)) / 60), 0)::int
       from availability),
    (select coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0)::int
       from appointments
      where status = 'confirmed' and starts_at between now() and now() + interval '7 days');
$$;

grant execute on function public.metricas_consultorio(timestamptz, timestamptz) to authenticated;
