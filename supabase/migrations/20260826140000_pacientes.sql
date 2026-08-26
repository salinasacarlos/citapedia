-- CitaPedia — pacientes con expediente.
--
-- Tres decisiones de forma que conviene entender antes de tocar esto:
--
-- 1. `patients` gana dueño. Hasta ahora un paciente solo era alcanzable a
--    través de sus citas: no se podía listar "mis pacientes" ni dar de alta a
--    alguien que todavía no agenda.
--
-- 2. Sirve para adultos y para menores. El paciente es siempre la persona
--    atendida; los datos del tutor son opcionales y se llenan cuando hay uno.
--
-- 3. Lo clínico vive en tablas aparte. RLS filtra filas, no columnas: para que
--    el asistente vea el teléfono pero no las alergias, tienen que ser tablas
--    distintas con políticas distintas.

-- ------------------------------------------------------ identidad

alter table public.patients
  add column professional_id uuid references public.professionals(id) on delete cascade,
  add column birth_date date,
  add column sex text,
  add column tutor_name text,
  add column tutor_phone text,
  add column tutor_relationship text;

alter table public.patients
  add constraint patients_sex_valido
  check (sex is null or sex in ('femenino', 'masculino', 'otro'));

alter table public.patients
  add constraint patients_nacimiento_razonable
  check (birth_date is null or (birth_date <= current_date and birth_date > '1900-01-01'));

-- Cada paciente existente pertenece al consultorio con el que tiene citas.
update public.patients p
   set professional_id = (
     select a.professional_id from public.appointments a
      where a.patient_id = p.id
      order by a.created_at
      limit 1
   )
 where professional_id is null;

-- Los que quedaran sin citas no le sirven a nadie.
delete from public.patients where professional_id is null;

alter table public.patients alter column professional_id set not null;

create index patients_professional_id_idx on public.patients (professional_id);

-- Con dueño, las políticas dejan de tener que rodear por las citas.
drop policy if exists patients_select_members on public.patients;
drop policy if exists patients_insert_members on public.patients;
drop policy if exists patients_update_members on public.patients;

create policy patients_all_members on public.patients
  for all to authenticated
  using (public.is_member(professional_id))
  with check (public.is_member(professional_id));

-- ------------------------------------------- expediente: solo el médico

-- Lo que el asistente NO debe ver. Va aparte justamente por eso.
create table public.clinical_records (
  patient_id      uuid primary key references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  allergies       text,
  conditions      text,
  medications     text,
  blood_type      text,
  notes           text,
  updated_at      timestamptz default now()
);

alter table public.clinical_records enable row level security;

create policy clinical_records_owner on public.clinical_records
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

create trigger clinical_records_set_updated_at
  before update on public.clinical_records
  for each row execute function public.set_updated_at();

-- ------------------------------------------ notas de consulta y medidas

-- Una fila por consulta. `appointments.notes` es lo que escribió el paciente
-- al pedir cita; esto es lo que encontró el médico. Mezclarlos sería perder
-- de quién viene cada cosa.
create table public.consultation_notes (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  note            text,
  weight_kg       numeric(5, 2),
  height_cm       numeric(5, 1),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint consultation_notes_peso_razonable
    check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  constraint consultation_notes_talla_razonable
    check (height_cm is null or (height_cm > 0 and height_cm < 300))
);

alter table public.consultation_notes enable row level security;

create policy consultation_notes_owner on public.consultation_notes
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

create index consultation_notes_patient_idx
  on public.consultation_notes (patient_id, created_at desc);

create trigger consultation_notes_set_updated_at
  before update on public.consultation_notes
  for each row execute function public.set_updated_at();

-- ------------------------------- la reserva pública ahora asigna dueño

create or replace function public.solicitar_cita(
  p_slug       text,
  p_starts_at  timestamptz,
  p_nombre     text,
  p_telefono   text default null,
  p_email      text default null,
  p_notas      text default null
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

  -- Ahora el paciente tiene dueño, así que reconocerlo es directo.
  select pa.id into v_paciente
    from public.patients pa
   where pa.professional_id = pro.id
     and (
       (coalesce(p_email, '')    <> '' and pa.email = p_email) or
       (coalesce(p_telefono, '') <> '' and pa.phone = p_telefono)
     )
   limit 1;

  if v_paciente is null then
    insert into public.patients (professional_id, name, phone, email)
    values (pro.id, trim(p_nombre), nullif(trim(p_telefono), ''), nullif(trim(p_email), ''))
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
