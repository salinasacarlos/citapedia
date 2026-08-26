-- CitaPedia — el consultorio agenda directo.
--
-- Hasta ahora toda cita nacía en la página pública. La realidad de un
-- consultorio es que la gente llama o escribe por WhatsApp, y la recepcionista
-- necesita agendar mientras tiene a la persona en la línea — no decirle "entra
-- a la página y agéndalo tú".
--
-- Nace confirmada: no tiene sentido que el consultorio se mande una solicitud
-- a sí mismo para después aceptarla.
--
-- SECURITY INVOKER, igual que reagendar_cita: quien agenda ya es miembro, así
-- que RLS decide sobre qué consultorio puede escribir.

create or replace function public.agendar_cita(
  p_paciente  uuid,
  p_inicio    timestamptz,
  p_duracion  int default null,
  p_notas     text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pac    public.patients%rowtype;
  pro    public.professionals%rowtype;
  v_fin  timestamptz;
  v_loc  timestamp;
  v_dur  int;
  v_cita uuid;
begin
  -- RLS filtra: un paciente de otro consultorio simplemente no aparece.
  select * into pac from public.patients where id = p_paciente;
  if not found then
    raise exception 'No encontramos ese paciente.' using errcode = 'no_data_found';
  end if;

  select * into pro from public.professionals where id = pac.professional_id;

  v_dur := coalesce(p_duracion, pro.slot_duration, 30);
  if v_dur < 5 or v_dur > 240 then
    raise exception 'La duración debe estar entre 5 y 240 minutos.'
      using errcode = 'check_violation';
  end if;

  if p_inicio <= now() then
    raise exception 'Ese horario ya pasó.' using errcode = 'check_violation';
  end if;

  v_fin := p_inicio + (v_dur || ' minutes')::interval;
  v_loc := p_inicio at time zone pro.timezone;

  if not exists (
    select 1 from public.availability a
     where a.professional_id = pro.id
       and a.weekday = extract(dow from v_loc)::int
       and v_loc::time >= a.start_time
       and (v_fin at time zone pro.timezone)::time <= a.end_time
  ) then
    raise exception 'Ese horario está fuera del horario de atención.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.time_blocks b
     where b.professional_id = pro.id
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Ese rato está bloqueado.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.appointments c
     where c.professional_id = pro.id
       and c.status = 'confirmed'
       and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Ya hay otra cita confirmada en ese horario.'
      using errcode = 'check_violation';
  end if;

  insert into public.appointments
    (professional_id, patient_id, starts_at, ends_at, status, notes)
  values
    (pro.id, pac.id, p_inicio, v_fin, 'confirmed', nullif(trim(p_notas), ''))
  returning id into v_cita;

  return v_cita;
end;
$$;

revoke all on function public.agendar_cita(uuid, timestamptz, int, text) from public;
grant execute on function public.agendar_cita(uuid, timestamptz, int, text) to authenticated;
