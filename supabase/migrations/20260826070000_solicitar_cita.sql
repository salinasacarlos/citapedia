-- CitaPedia — reserva desde la página pública.
--
-- El público NO escribe en appointments: RLS se lo impide. Pide cita por esta
-- función, que corre con permisos elevados y valida en un solo lugar lo que la
-- UI solo puede sugerir: que el hueco exista, esté libre y siga en el futuro.
-- Si la UI se equivoca o alguien llama la API a mano, aquí se detiene.

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
  pro         public.professionals%rowtype;
  v_ends_at   timestamptz;
  v_local     timestamp;
  v_paciente  uuid;
  v_cita      uuid;
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

  -- ¿Cae dentro del horario que el médico publicó para ese día?
  if not exists (
    select 1 from public.availability a
     where a.professional_id = pro.id
       and a.weekday = extract(dow from v_local)::int
       and v_local::time >= a.start_time
       and (v_ends_at at time zone pro.timezone)::time <= a.end_time
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  -- ¿El médico tapó ese rato?
  if exists (
    select 1 from public.time_blocks b
     where b.professional_id = pro.id
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  -- ¿Ya hay una cita confirmada encima? Las solicitudes pendientes NO
  -- bloquean: varios pueden pedir el mismo hueco y el médico elige.
  if exists (
    select 1 from public.appointments c
     where c.professional_id = pro.id
       and c.status = 'confirmed'
       and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'Alguien acaba de tomar ese horario.' using errcode = 'check_violation';
  end if;

  -- Freno simple contra el spam: pocas solicitudes vivas por contacto.
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

  -- Reusamos al paciente solo si ya tuvo cita CON ESTE consultorio, para no
  -- enlazar expedientes entre médicos distintos.
  select pa.id into v_paciente
    from public.patients pa
   where exists (
           select 1 from public.appointments c
            where c.patient_id = pa.id and c.professional_id = pro.id
         )
     and (
       (coalesce(p_email, '')    <> '' and pa.email = p_email) or
       (coalesce(p_telefono, '') <> '' and pa.phone = p_telefono)
     )
   limit 1;

  if v_paciente is null then
    insert into public.patients (name, phone, email)
    values (trim(p_nombre), nullif(trim(p_telefono), ''), nullif(trim(p_email), ''))
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

revoke all on function public.solicitar_cita(text, timestamptz, text, text, text, text) from public;
grant execute on function public.solicitar_cita(text, timestamptz, text, text, text, text)
  to anon, authenticated;
