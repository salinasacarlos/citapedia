-- CitaPedia — la liga que la recepcionista manda por WhatsApp.
--
-- El paciente abre su cita, la confirma, avisa si no puede venir, y —si es
-- nuevo— adelanta sus datos médicos.
--
-- Hasta ahora los datos declarados se identificaban con el id de la cita y una
-- ventana de 24 horas. Eso servía para la pantalla de confirmación inmediata,
-- pero una liga que se manda tres días antes necesita una credencial de
-- verdad: 24 bytes al azar, no un id que aparece en la URL del admin.

-- Dos uuid pegados: 64 caracteres hexadecimales, inadivinables. Se usa
-- `gen_random_uuid` y no `gen_random_bytes` porque la primera es del núcleo de
-- Postgres y la segunda vive en el esquema `extensions` en Supabase, fuera del
-- search_path de las migraciones.
alter table public.appointments
  add column access_token text not null
  default replace(gen_random_uuid()::text, '-', '') ||
          replace(gen_random_uuid()::text, '-', '');

create unique index appointments_access_token_idx on public.appointments (access_token);

/**
 * Lo que el paciente puede ver de su cita. Devuelve solo lo suyo: nada del
 * resto de la agenda ni de otros pacientes.
 */
create or replace function public.ver_cita(p_token text)
returns table (
  cita_id          uuid,
  consultorio      text,
  slug             text,
  direccion        text,
  telefono         text,
  zona             text,
  paciente         text,
  inicio           timestamptz,
  fin              timestamptz,
  estado           public.appointment_status,
  confirmada_por_paciente boolean,
  ya_declaro       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.name, p.slug, p.clinic_address, p.phone, p.timezone,
         pa.name, c.starts_at, c.ends_at, c.status,
         c.patient_confirmed_at is not null,
         exists (select 1 from public.declared_records d where d.patient_id = pa.id)
    from public.appointments c
    join public.professionals p on p.id = c.professional_id
    left join public.patients pa on pa.id = c.patient_id
   where c.access_token = p_token;
$$;

/** El paciente dice que sí viene, sin que nadie tenga que preguntarle. */
create or replace function public.confirmar_asistencia(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cita public.appointments%rowtype;
begin
  select * into cita from public.appointments where access_token = p_token;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if cita.status <> 'confirmed' then
    raise exception 'Esta cita todavía no está confirmada por el consultorio.'
      using errcode = 'check_violation';
  end if;

  if cita.starts_at <= now() then
    raise exception 'Esa cita ya pasó.' using errcode = 'check_violation';
  end if;

  update public.appointments
     set patient_confirmed_at = now()
   where id = cita.id;
end;
$$;

/**
 * El paciente avisa que no puede venir.
 *
 * Es el único camino a `cancelled_by_patient`, que estaba en la máquina de
 * estados desde la primera migración sin forma de alcanzarse.
 */
create or replace function public.cancelar_cita_paciente(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cita public.appointments%rowtype;
begin
  select * into cita from public.appointments where access_token = p_token;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if cita.status <> 'confirmed' then
    raise exception 'Solo se puede cancelar una cita confirmada.'
      using errcode = 'check_violation';
  end if;

  if cita.starts_at <= now() then
    raise exception 'Esa cita ya pasó. Habla al consultorio.'
      using errcode = 'check_violation';
  end if;

  update public.appointments
     set status = 'cancelled_by_patient', patient_confirmed_at = null
   where id = cita.id;
end;
$$;

-- Los datos médicos ahora se identifican con el token, no con el id, y la
-- ventana se abre hasta el día de la cita: la liga se manda con anticipación.
create or replace function public.declarar_datos_medicos(
  p_token          text,
  p_consentimiento boolean,
  p_alergias       text default null,
  p_padecimientos  text default null,
  p_medicamentos   text default null,
  p_tipo_sangre    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cita public.appointments%rowtype;
begin
  if not p_consentimiento then
    raise exception 'Necesitamos tu permiso para guardar datos de salud.'
      using errcode = 'check_violation';
  end if;

  select * into cita from public.appointments where access_token = p_token;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if cita.patient_id is null then
    raise exception 'Esa cita no tiene paciente asociado.' using errcode = 'no_data_found';
  end if;

  -- Después de la consulta ya no tiene sentido adelantar nada.
  if cita.ends_at < now() then
    raise exception 'Esta cita ya pasó.' using errcode = 'check_violation';
  end if;

  insert into public.declared_records (
    patient_id, professional_id, allergies, conditions, medications, blood_type
  )
  values (
    cita.patient_id, cita.professional_id,
    nullif(trim(p_alergias), ''),
    nullif(trim(p_padecimientos), ''),
    nullif(trim(p_medicamentos), ''),
    nullif(trim(p_tipo_sangre), '')
  )
  on conflict (patient_id) do update
    set allergies   = excluded.allergies,
        conditions  = excluded.conditions,
        medications = excluded.medications,
        blood_type  = excluded.blood_type,
        declared_at = now(),
        consent_at  = now(),
        reviewed_at = null,
        reviewed_by = null;
end;
$$;

drop function if exists public.declarar_datos_medicos(uuid, boolean, text, text, text, text);

-- La reserva pública devuelve el token: es lo que el paciente necesita para
-- volver a su cita, no un id que no le sirve de nada. Cambiar el tipo de
-- retorno obliga a soltar la función antes de recrearla.
drop function if exists public.solicitar_cita(text, timestamptz, text, text, text, text, text, text);

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
      is_minor, tutor_name, tutor_phone, tutor_email, tutor_relationship
    )
    values (
      pro.id, trim(p_nombre),
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
  returning access_token into v_token;

  return v_token;
end;
$$;

revoke all on function public.ver_cita(text) from public;
revoke all on function public.confirmar_asistencia(text) from public;
revoke all on function public.cancelar_cita_paciente(text) from public;
grant execute on function public.ver_cita(text) to anon, authenticated;
grant execute on function public.confirmar_asistencia(text) to anon, authenticated;
grant execute on function public.cancelar_cita_paciente(text) to anon, authenticated;
grant execute on function public.declarar_datos_medicos(text, boolean, text, text, text, text)
  to anon, authenticated;

revoke all on function public.solicitar_cita(text, timestamptz, text, text, text, text, text, text) from public;
grant execute on function public.solicitar_cita(text, timestamptz, text, text, text, text, text, text)
  to anon, authenticated;
