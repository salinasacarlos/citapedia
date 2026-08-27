-- La confirmación del paciente trababa la cita.
--
-- El trigger corría también al cambiar `status`, así que una cita que el
-- paciente ya confirmó no se podía cancelar, ni cerrar como atendida, ni
-- marcar inasistencia, ni reagendar: cualquier estado distinto de 'confirmed'
-- levantaba "Solo una cita confirmada por el consultorio puede confirmarse con
-- el paciente", un mensaje que además no tenía nada que ver con lo que se
-- estaba intentando.
--
-- La regla que se quería es sobre el ACTO de confirmar: no se puede marcar que
-- el paciente viene a una cita que el consultorio todavía no aceptó. Una vez
-- marcada, la cita sigue su vida normal y la marca se queda como historia.

create or replace function public.validar_confirmacion_paciente()
returns trigger
language plpgsql
as $$
begin
  if new.patient_confirmed_at is not null
     and (tg_op = 'INSERT'
          or new.patient_confirmed_at is distinct from old.patient_confirmed_at)
     and new.status <> 'confirmed' then
    raise exception 'Solo se puede confirmar la asistencia de una cita que el consultorio ya aceptó.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
