-- Números del consultorio, para la pantalla de Inicio.
--
-- SECURITY INVOKER a propósito: son los datos del propio médico y RLS ya sabe
-- cuáles son suyos. Elevarse aquí sería darle a esta función la capacidad de
-- ver consultorios ajenos sin ninguna razón para tenerla.
--
-- Devuelve **conteos crudos, no porcentajes**. Un "33% de inasistencia" sobre
-- tres citas es ruido con aspecto de dato; que la pantalla vea el denominador
-- es lo que le permite callarse cuando no hay de dónde concluir.

create or replace function public.metricas_consultorio()
returns table (
  pacientes            int,
  pacientes_30d        int,
  -- Ahora mismo, lo que pide acción.
  por_revisar          int,
  por_cerrar           int,
  proximas_7d          int,
  sin_confirmar_7d     int,
  -- Últimos 30 días, ya cerrados.
  atendidas_30d        int,
  inasistencias_30d    int,
  canceladas_30d       int,
  -- El dato que responde "¿sirve pedirles que confirmen?".
  cerradas_con_confirmacion   int,
  faltaron_con_confirmacion   int,
  cerradas_sin_confirmacion   int,
  faltaron_sin_confirmacion   int,
  -- Ocupación: minutos publicados por semana contra minutos ya apartados.
  minutos_semana       int,
  minutos_agendados_7d int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::int from patients),
    (select count(*)::int from patients where created_at > now() - interval '30 days'),

    (select count(*)::int from appointments
      where status = 'requested' and starts_at >= now()),
    (select count(*)::int from appointments
      where status = 'confirmed' and ends_at < now()),
    (select count(*)::int from appointments
      where status = 'confirmed' and starts_at between now() and now() + interval '7 days'),
    (select count(*)::int from appointments
      where status = 'confirmed' and patient_confirmed_at is null
        and starts_at between now() and now() + interval '7 days'),

    (select count(*)::int from appointments
      where status = 'completed' and starts_at > now() - interval '30 days'),
    (select count(*)::int from appointments
      where status = 'no_show' and starts_at > now() - interval '30 days'),
    (select count(*)::int from appointments
      where status in ('cancelled_by_patient', 'cancelled_by_professional')
        and starts_at > now() - interval '30 days'),

    (select count(*)::int from appointments
      where status in ('completed', 'no_show') and patient_confirmed_at is not null),
    (select count(*)::int from appointments
      where status = 'no_show' and patient_confirmed_at is not null),
    (select count(*)::int from appointments
      where status in ('completed', 'no_show') and patient_confirmed_at is null),
    (select count(*)::int from appointments
      where status = 'no_show' and patient_confirmed_at is null),

    (select coalesce(sum(extract(epoch from (end_time - start_time)) / 60), 0)::int
       from availability),
    (select coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0)::int
       from appointments
      where status = 'confirmed' and starts_at between now() and now() + interval '7 days');
$$;

grant execute on function public.metricas_consultorio() to authenticated;
