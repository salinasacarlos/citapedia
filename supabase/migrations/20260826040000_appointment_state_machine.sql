-- CitaPedia — la máquina de estados vive en el motor, no en la UI.
--
-- Cualquier camino de escritura (la app, la API, un cron, alguien con la
-- consola abierta) queda sujeto a las mismas transiciones:
--
--   requested ─▶ confirmed ─▶ completed
--       │            ├─▶ cancelled_by_patient
--       │            ├─▶ cancelled_by_professional
--       │            ├─▶ rescheduled  (obliga a rescheduled_to)
--       │            └─▶ no_show
--       ├─▶ rejected
--       └─▶ expired
--
-- rejected, expired, completed, no_show y las canceladas son terminales.

create or replace function public.enforce_appointment_transition()
returns trigger
language plpgsql
as $$
declare
  permitidos public.appointment_status[];
begin
  if new.status = old.status then
    return new;
  end if;

  permitidos := case old.status
    when 'requested' then
      array['confirmed', 'rejected', 'expired']::public.appointment_status[]
    when 'confirmed' then
      array['completed', 'cancelled_by_patient', 'cancelled_by_professional',
            'rescheduled', 'no_show']::public.appointment_status[]
    else
      array[]::public.appointment_status[]
  end;

  if not (new.status = any (permitidos)) then
    raise exception 'Transición de cita inválida: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- Reagendar sin decir a dónde deja la cita vieja huérfana.
  if new.status = 'rescheduled' and new.rescheduled_to is null then
    raise exception 'Una cita reagendada debe apuntar a la nueva con rescheduled_to'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_enforce_transition on public.appointments;
create trigger appointments_enforce_transition
  before update of status on public.appointments
  for each row execute function public.enforce_appointment_transition();
