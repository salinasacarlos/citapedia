-- CitaPedia — reagendar una cita.
--
-- Mover una cita son dos escrituras que no pueden quedar a medias: si se crea
-- la nueva y falla el cierre de la vieja, el paciente queda con dos citas. Va
-- en una función para que sea una sola transacción.
--
-- SECURITY INVOKER a propósito: corre con los permisos de quien llama, así que
-- RLS sigue decidiendo qué citas puede tocar. No hace falta elevarse.

-- Al mover una cita unos minutos, la vieja y la nueva se encinan por un
-- instante dentro de la misma transacción. La restricción se vuelve aplazable
-- para que se revise al final, cuando la vieja ya dejó de estar confirmada.
alter table public.appointments
  drop constraint appointments_no_overlap_when_confirmed;

alter table public.appointments
  add constraint appointments_no_overlap_when_confirmed
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
  deferrable initially immediate;

create or replace function public.reagendar_cita(p_cita uuid, p_inicio timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  vieja public.appointments%rowtype;
  pro   public.professionals%rowtype;
  v_fin timestamptz;
  v_loc timestamp;
  nueva uuid;
begin
  -- RLS ya filtra: si no es suya, simplemente no la encuentra.
  select * into vieja from public.appointments where id = p_cita;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if vieja.status <> 'confirmed' then
    raise exception 'Solo se puede reagendar una cita confirmada.'
      using errcode = 'check_violation';
  end if;

  if p_inicio = vieja.starts_at then
    raise exception 'Esa es la misma hora que ya tenía.' using errcode = 'check_violation';
  end if;

  if p_inicio <= now() then
    raise exception 'El horario nuevo ya pasó.' using errcode = 'check_violation';
  end if;

  select * into pro from public.professionals where id = vieja.professional_id;

  -- La cita conserva su duración: reagendar es moverla, no reconfigurarla.
  v_fin := p_inicio + (vieja.ends_at - vieja.starts_at);
  v_loc := p_inicio at time zone pro.timezone;

  if not exists (
    select 1 from public.availability a
     where a.professional_id = pro.id
       and a.weekday = extract(dow from v_loc)::int
       and v_loc::time >= a.start_time
       and (v_fin at time zone pro.timezone)::time <= a.end_time
  ) then
    raise exception 'Ese horario está fuera de tu horario de atención.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.time_blocks b
     where b.professional_id = pro.id
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Ese rato lo tienes bloqueado.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.appointments c
     where c.professional_id = pro.id
       and c.status = 'confirmed'
       and c.id <> vieja.id
       and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Ya tienes otra cita confirmada en ese horario.'
      using errcode = 'check_violation';
  end if;

  set constraints public.appointments_no_overlap_when_confirmed deferred;

  insert into public.appointments
    (professional_id, patient_id, starts_at, ends_at, status, notes)
  values
    (vieja.professional_id, vieja.patient_id, p_inicio, v_fin, 'confirmed', vieja.notes)
  returning id into nueva;

  update public.appointments
     set status = 'rescheduled', rescheduled_to = nueva
   where id = vieja.id;

  return nueva;
end;
$$;

revoke all on function public.reagendar_cita(uuid, timestamptz) from public;
grant execute on function public.reagendar_cita(uuid, timestamptz) to authenticated;
