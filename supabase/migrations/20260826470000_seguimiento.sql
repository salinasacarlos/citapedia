-- Cuándo debe volver el paciente.
--
-- "Te veo en tres meses" se dice en cada consulta y hoy no queda en ningún
-- lado: vive en la memoria del médico y en la del paciente, que es donde se
-- pierde. El paciente no vuelve, y nadie se entera de que dejó de venir.
--
-- Se guarda en la nota de consulta y no en el paciente por una razón: es una
-- indicación clínica de ESA visita. Si el mes que viene se le dice otra cosa,
-- la anterior queda en su lugar, con su historia, y no se sobreescribe.

alter table public.consultation_notes
  add column follow_up_at    date,
  add column follow_up_reason text;

comment on column public.consultation_notes.follow_up_at is
  'Cuándo debería volver. Es la indicación de esta consulta, no un campo del '
  'paciente: la de la visita siguiente no borra esta.';

/**
 * A quién le toca volver y todavía no tiene cita.
 *
 * Es la lista que trabaja la recepcionista, y por eso excluye a quien ya tiene
 * algo agendado: llamarle a alguien que ya viene el jueves quema la confianza
 * en la lista y hace que se deje de usar.
 *
 * SECURITY INVOKER: son los pacientes del propio médico y RLS ya lo acota.
 */
create or replace function public.controles_pendientes(p_dias_de_gracia int default 0)
returns table (
  patient_id   uuid,
  paciente     text,
  telefono     text,
  es_menor     boolean,
  tutor        text,
  toca_el      date,
  motivo       text,
  ultima_visita timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (n.patient_id)
         n.patient_id,
         p.name,
         coalesce(case when p.is_minor then p.tutor_phone else p.phone end, p.phone),
         coalesce(p.is_minor, false),
         case when p.is_minor then p.tutor_name end,
         n.follow_up_at,
         n.follow_up_reason,
         (select max(c.starts_at) from appointments c
           where c.patient_id = n.patient_id and c.status = 'completed')
    from consultation_notes n
    join patients p on p.id = n.patient_id
   where n.follow_up_at is not null
     and n.follow_up_at <= current_date + coalesce(p_dias_de_gracia, 0)
     -- Ya tiene algo agendado hacia adelante: no hay a quién llamar.
     and not exists (
       select 1 from appointments c
        where c.patient_id = n.patient_id
          and c.status in ('requested', 'confirmed')
          and c.starts_at >= now()
     )
   order by n.patient_id, n.follow_up_at desc
$$;

grant execute on function public.controles_pendientes(int) to authenticated;

-- La lista pregunta por fecha de control; sin índice recorre todas las notas.
create index if not exists consultation_notes_control_idx
  on public.consultation_notes (professional_id, follow_up_at)
  where follow_up_at is not null;
