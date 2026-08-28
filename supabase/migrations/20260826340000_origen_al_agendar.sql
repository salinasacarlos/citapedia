-- De dónde llegó, preguntado en la propia página del médico.
--
-- Es el mejor lugar para preguntarlo: el paciente lo sabe de primera mano, y
-- la recepcionista no tiene que acordarse de preguntarlo por teléfono.
--
-- `recurrente` es una respuesta legítima y por eso entra al catálogo: quien ya
-- es paciente y vuelve a agendar no es captación nueva, y contarlo como si lo
-- fuera inflaría cualquier medición de a dónde va el dinero.

alter table public.patients drop constraint patients_source_valido;

alter table public.patients
  add constraint patients_source_valido
  check (
    source is null
    or source in ('paciente', 'medico', 'internet', 'redes', 'directorio',
                  'seguro', 'paso', 'recurrente', 'otro')
  );

create or replace function public.solicitar_cita(
  p_slug        text,
  p_starts_at   timestamptz,
  p_nombre      text,
  p_telefono    text default null,
  p_email       text default null,
  p_notas       text default null,
  p_tutor       text default null,
  p_parentesco  text default null,
  p_origen      text default null,
  p_referido    text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro          public.professionals%rowtype;
  v_ends_at    timestamptz;
  v_local      timestamp;
  v_paciente   uuid;
  v_token      text;
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
      is_minor, tutor_name, tutor_phone, tutor_email, tutor_relationship,
      source, referred_by
    )
    values (
      pro.id, trim(p_nombre),
      case when not v_para_otro then nullif(trim(p_telefono), '') end,
      case when not v_para_otro then nullif(trim(p_email), '') end,
      v_para_otro,
      nullif(trim(p_tutor), ''),
      case when v_para_otro then nullif(trim(p_telefono), '') end,
      case when v_para_otro then nullif(trim(p_email), '') end,
      nullif(trim(p_parentesco), ''),
      -- El origen solo se guarda al crear la ficha. A quien ya es paciente no
      -- se le reescribe de dónde vino la primera vez.
      nullif(trim(p_origen), ''),
      nullif(trim(p_referido), '')
    )
    returning id into v_paciente;
  end if;

  insert into public.appointments
    (professional_id, patient_id, starts_at, ends_at, status, notes)
  values
    (pro.id, v_paciente, p_starts_at, v_ends_at, 'requested', nullif(trim(p_notas), ''))
  returning access_token into v_token;

  return v_token;
end;
$$;

grant execute on function public.solicitar_cita(
  text, timestamptz, text, text, text, text, text, text, text, text
) to anon, authenticated;
