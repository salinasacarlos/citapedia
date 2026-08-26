-- CitaPedia — más datos del expediente, y quién es quién.
--
-- El reparto sigue la misma regla de siempre: lo que el asistente necesita
-- para operar la agenda va en `patients`; lo clínico va en las tablas de solo
-- dueño. Un contacto de emergencia o la aseguradora son operativos: si un
-- niño se pone mal en la sala, la asistente tiene que poder llamar.

alter table public.patients
  add column is_minor boolean,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column emergency_contact_relationship text,
  add column insurance text,
  add column notes text;

comment on column public.patients.is_minor is
  'Si la cita la agendó alguien más para este paciente. Se guarda explícito '
  'porque la fecha de nacimiento puede faltar, y adivinar de quién es el '
  'teléfono a partir de la edad es justo el error que queremos evitar.';

-- Los que ya tienen tutor registrado, evidentemente dependen de alguien.
update public.patients set is_minor = true where tutor_name is not null;

-- ------------------------------------------------ expediente clínico

alter table public.clinical_records
  add column family_history text,
  add column surgical_history text,
  add column immunizations text,
  add column habits text;

-- ------------------------------------- signos vitales y desenlace clínico

alter table public.consultation_notes
  add column temperature_c      numeric(4, 1),
  add column blood_pressure     text,
  add column heart_rate         int,
  add column oxygen_saturation  int,
  add column diagnosis          text,
  add column treatment          text;

alter table public.consultation_notes
  add constraint consultation_notes_temperatura_razonable
  check (temperature_c is null or (temperature_c between 25 and 45));

alter table public.consultation_notes
  add constraint consultation_notes_pulso_razonable
  check (heart_rate is null or (heart_rate between 20 and 300));

alter table public.consultation_notes
  add constraint consultation_notes_saturacion_razonable
  check (oxygen_saturation is null or (oxygen_saturation between 50 and 100));

-- --------------------------------- la reserva pública distingue quién es quién

-- Antes el nombre era del paciente y el teléfono, de quien agendaba, sin que
-- nada dijera cuál era cuál. Ahora se pregunta.
create or replace function public.solicitar_cita(
  p_slug        text,
  p_starts_at   timestamptz,
  p_nombre      text,
  p_telefono    text default null,
  p_email       text default null,
  p_notas       text default null,
  p_tutor       text default null,
  p_parentesco  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro          public.professionals%rowtype;
  v_ends_at    timestamptz;
  v_local      timestamp;
  v_paciente   uuid;
  v_cita       uuid;
  v_pendientes int;
  v_para_otro  boolean := coalesce(trim(p_tutor), '') <> '';
begin
  select * into pro from public.professionals where slug = p_slug;
  if not found then
    raise exception 'No encontramos ese consultorio.' using errcode = 'no_data_found';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Necesitamos el nombre del paciente.' using errcode = 'check_violation';
  end if;

  if coalesce(trim(p_telefono), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'Déjanos un teléfono o un correo para confirmarte.'
      using errcode = 'check_violation';
  end if;

  if p_starts_at <= now() then
    raise exception 'Ese horario ya pasó.' using errcode = 'check_violation';
  end if;

  v_ends_at := p_starts_at + (coalesce(pro.slot_duration, 30) || ' minutes')::interval;
  v_local   := p_starts_at at time zone pro.timezone;

  if not exists (
    select 1 from public.availability a
     where a.professional_id = pro.id
       and a.weekday = extract(dow from v_local)::int
       and v_local::time >= a.start_time
       and (v_ends_at at time zone pro.timezone)::time <= a.end_time
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.time_blocks b
     where b.professional_id = pro.id
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.appointments c
     where c.professional_id = pro.id
       and c.status = 'confirmed'
       and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'Alguien acaba de tomar ese horario.' using errcode = 'check_violation';
  end if;

  select count(*) into v_pendientes
    from public.appointments c
    join public.patients pa on pa.id = c.patient_id
   where c.professional_id = pro.id
     and c.status = 'requested'
     and (
       (coalesce(p_email, '')    <> '' and pa.email = p_email) or
       (coalesce(p_telefono, '') <> '' and pa.phone = p_telefono)
     );

  if v_pendientes >= 3 then
    raise exception 'Ya tienes varias solicitudes pendientes con este consultorio. Espera la respuesta.'
      using errcode = 'check_violation';
  end if;

  -- Se reconoce por contacto Y nombre: una mamá que agenda para dos hijos usa
  -- el mismo teléfono, y no son el mismo paciente.
  select pa.id into v_paciente
    from public.patients pa
   where pa.professional_id = pro.id
     and lower(pa.name) = lower(trim(p_nombre))
     and (
       (coalesce(p_email, '')    <> '' and pa.email = p_email) or
       (coalesce(p_telefono, '') <> '' and pa.phone = p_telefono)
     )
   limit 1;

  if v_paciente is null then
    insert into public.patients (
      professional_id, name, phone, email,
      is_minor, tutor_name, tutor_phone, tutor_relationship
    )
    values (
      pro.id, trim(p_nombre),
      nullif(trim(p_telefono), ''), nullif(trim(p_email), ''),
      v_para_otro,
      nullif(trim(p_tutor), ''),
      -- Si agenda para otro, el teléfono que dejó es suyo, no del paciente.
      case when v_para_otro then nullif(trim(p_telefono), '') end,
      nullif(trim(p_parentesco), '')
    )
    returning id into v_paciente;
  end if;

  insert into public.appointments
    (professional_id, patient_id, starts_at, ends_at, status, notes)
  values
    (pro.id, v_paciente, p_starts_at, v_ends_at, 'requested', nullif(trim(p_notas), ''))
  returning id into v_cita;

  return v_cita;
end;
$$;

revoke all on function public.solicitar_cita(text, timestamptz, text, text, text, text, text, text) from public;
grant execute on function public.solicitar_cita(text, timestamptz, text, text, text, text, text, text)
  to anon, authenticated;

-- La firma vieja de seis argumentos ya no se usa.
drop function if exists public.solicitar_cita(text, timestamptz, text, text, text, text);
