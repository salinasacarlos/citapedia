-- CitaPedia — confirmación de asistencia del paciente.
--
-- `status = 'confirmed'` significa que el consultorio aceptó la cita. Que el
-- paciente diga "ahí estaré" es otra cosa, y es lo que baja las inasistencias.
--
-- Va como marcas de tiempo, no como estado del enum, a propósito: la
-- restricción que impide dobles reservas filtra por `status = 'confirmed'`, y
-- un estado nuevo quedaría fuera de ella — el hueco se volvería a ofrecer al
-- público. Ocho consultas más filtran por ese mismo valor. Como columna, la
-- interfaz muestra la distinción y la lógica de agenda no se entera.

alter table public.appointments
  add column confirmation_sent_at  timestamptz,
  add column patient_confirmed_at  timestamptz;

comment on column public.appointments.confirmation_sent_at is
  'Cuándo se le escribió al paciente para confirmar. Sirve para distinguir '
  '"falta escribirle" de "ya le escribí, falta que conteste".';

comment on column public.appointments.patient_confirmed_at is
  'Cuándo el paciente dijo que sí viene. Lo marca la recepcionista a mano, '
  'después de que el paciente responde.';

-- Confirmar asistencia solo tiene sentido sobre una cita que el consultorio ya
-- aceptó; la interfaz no lo ofrece antes, y aquí queda respaldado.
create or replace function public.validar_confirmacion_paciente()
returns trigger
language plpgsql
as $$
begin
  if new.patient_confirmed_at is not null and new.status <> 'confirmed' then
    raise exception 'Solo una cita confirmada por el consultorio puede confirmarse con el paciente.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_validar_confirmacion on public.appointments;
create trigger appointments_validar_confirmacion
  before insert or update of patient_confirmed_at, status on public.appointments
  for each row execute function public.validar_confirmacion_paciente();
