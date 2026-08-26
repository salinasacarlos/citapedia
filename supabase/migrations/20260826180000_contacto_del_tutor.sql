-- Al agendar para otra persona, el contacto que se deja es de quien agenda.
-- Guardarlo también como del paciente hacía que la ficha mostrara el mismo
-- teléfono dos veces, en dos renglones que dicen cosas distintas.

alter table public.patients add column tutor_email text;

-- Los que se crearon con la versión anterior traen el contacto duplicado.
update public.patients
   set tutor_email = email,
       email = null
 where is_minor = true and tutor_email is null and email is not null;

update public.patients
   set phone = null
 where is_minor = true and phone is not null and phone = tutor_phone;

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

  -- El contacto puede estar del lado del paciente o del tutor, según quién
  -- agendó. Se busca en los dos.
  select count(*) into v_pendientes
    from public.appointments c
    join public.patients pa on pa.id = c.patient_id
   where c.professional_id = pro.id
     and c.status = 'requested'
     and (
       (coalesce(p_email, '') <> ''
         and (pa.email = p_email or pa.tutor_email = p_email)) or
       (coalesce(p_telefono, '') <> ''
         and (pa.phone = p_telefono or pa.tutor_phone = p_telefono))
     );

  if v_pendientes >= 3 then
    raise exception 'Ya tienes varias solicitudes pendientes con este consultorio. Espera la respuesta.'
      using errcode = 'check_violation';
  end if;

  select pa.id into v_paciente
    from public.patients pa
   where pa.professional_id = pro.id
     and lower(pa.name) = lower(trim(p_nombre))
     and (
       (coalesce(p_email, '') <> ''
         and (pa.email = p_email or pa.tutor_email = p_email)) or
       (coalesce(p_telefono, '') <> ''
         and (pa.phone = p_telefono or pa.tutor_phone = p_telefono))
     )
   limit 1;

  if v_paciente is null then
    insert into public.patients (
      professional_id, name, phone, email,
      is_minor, tutor_name, tutor_phone, tutor_email, tutor_relationship
    )
    values (
      pro.id, trim(p_nombre),
      -- Si agendó alguien más, el contacto es suyo: no se le atribuye al
      -- paciente, que puede no tener teléfono propio.
      case when not v_para_otro then nullif(trim(p_telefono), '') end,
      case when not v_para_otro then nullif(trim(p_email), '') end,
      v_para_otro,
      nullif(trim(p_tutor), ''),
      case when v_para_otro then nullif(trim(p_telefono), '') end,
      case when v_para_otro then nullif(trim(p_email), '') end,
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
