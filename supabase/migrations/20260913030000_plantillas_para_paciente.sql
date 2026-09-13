-- Fase 5: qué plantillas le caben a ESTE paciente.
--
-- Lo que se recomienda son **las plantillas que el médico ya escribió**, nunca
-- un catálogo clínico nuestro. Sugerir un esquema de vacunación es una
-- afirmación médica, y CitaPedia no tiene con qué respaldarla; ordenar lo que
-- el médico decidió, sí.
--
-- Las tres señales son de su propia operación, no de medicina:
--   · cuándo caería para este paciente,
--   · si ya se la programó (para no duplicar),
--   · con cuántos de sus pacientes la usa (lo que hace habitualmente).
--
-- Reemplaza una consulta por plantilla desde la aplicación. Con tres no se
-- nota; con veinte plantillas y una sala llena, sí.
create or replace function public.plantillas_para_paciente(p_paciente uuid)
returns table (
  id            uuid,
  titulo        text,
  mensaje       text,
  base          text,
  offset_meses  int,
  cuando        date,
  ya_programado boolean,
  usos          int
)
language sql
stable
security invoker
set search_path = public
as $$
  with paciente as (
    select id, professional_id from patients where id = p_paciente
  )
  select t.id,
         t.titulo,
         t.mensaje,
         t.base,
         t.offset_meses,
         public.fecha_de_plantilla(t.id, p.id) as cuando,
         exists (
           select 1 from patient_alerts a
            where a.patient_id = p.id
              and a.titulo = t.titulo
              and a.status = 'pendiente'
         ) as ya_programado,
         (
           select count(distinct a.patient_id)::int
             from patient_alerts a
            where a.professional_id = t.professional_id
              and a.titulo = t.titulo
         ) as usos
    from alert_templates t
    join paciente p on p.professional_id = t.professional_id
   order by
     -- Lo que se puede hacer hoy va primero; lo que no aplica, al final.
     (public.fecha_de_plantilla(t.id, p.id) is null),
     (public.fecha_de_plantilla(t.id, p.id) < current_date),
     exists (
       select 1 from patient_alerts a
        where a.patient_id = p.id and a.titulo = t.titulo and a.status = 'pendiente'
     ),
     public.fecha_de_plantilla(t.id, p.id);
$$;

revoke execute on function public.plantillas_para_paciente(uuid) from public, anon;
grant execute on function public.plantillas_para_paciente(uuid) to authenticated;
