-- CitaPedia — lo que el paciente declara al agendar.
--
-- NO entra al expediente clínico. Lo que escribe un paciente a las once de la
-- noche y lo que el médico verificó en consulta no son el mismo dato, y si se
-- ven iguales alguien va a recetar sobre el equivocado.
--
-- Vive aparte, marcado como sin verificar, hasta que el médico lo revise y
-- decida pasarlo.

create table public.declared_records (
  patient_id      uuid primary key references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  allergies       text,
  conditions      text,
  medications     text,
  blood_type      text,
  -- Los datos de salud son sensibles: el consentimiento se guarda con su hora,
  -- no se asume.
  consent_at      timestamptz not null default now(),
  declared_at     timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id) on delete set null
);

alter table public.declared_records enable row level security;

-- Solo el médico los lee. Ni el público ni el asistente.
create policy declared_records_owner on public.declared_records
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

/**
 * El paciente acaba de agendar y se identifica con el id de esa cita.
 *
 * La ventana de 24 horas acota el daño si ese id se filtrara: pasado ese rato,
 * la liga ya no sirve para escribir nada.
 */
create or replace function public.declarar_datos_medicos(
  p_cita           uuid,
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

  select * into cita from public.appointments where id = p_cita;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if cita.created_at < now() - interval '24 hours' then
    raise exception 'Esta liga ya venció. Pídele al consultorio que capture tus datos.'
      using errcode = 'check_violation';
  end if;

  if cita.patient_id is null then
    raise exception 'Esa cita no tiene paciente asociado.' using errcode = 'no_data_found';
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
        -- Si el paciente lo cambia, vuelve a estar sin verificar.
        reviewed_at = null,
        reviewed_by = null;
end;
$$;

revoke all on function public.declarar_datos_medicos(uuid, boolean, text, text, text, text) from public;
grant execute on function public.declarar_datos_medicos(uuid, boolean, text, text, text, text)
  to anon, authenticated;

/**
 * El médico pasa lo declarado a su expediente.
 *
 * Solo llena lo que está vacío: si él ya escribió algo, lo suyo manda. Y lo
 * declarado no se borra — queda marcado como revisado, para que después se
 * pueda saber de dónde salió cada cosa.
 */
create or replace function public.aceptar_datos_declarados(p_paciente uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dec public.declared_records%rowtype;
begin
  -- RLS decide: si no es su paciente, no lo encuentra.
  select * into dec from public.declared_records where patient_id = p_paciente;
  if not found then
    raise exception 'No hay datos declarados para este paciente.' using errcode = 'no_data_found';
  end if;

  insert into public.clinical_records (
    patient_id, professional_id, allergies, conditions, medications, blood_type
  )
  values (
    dec.patient_id, dec.professional_id,
    dec.allergies, dec.conditions, dec.medications, dec.blood_type
  )
  on conflict (patient_id) do update
    set allergies   = coalesce(public.clinical_records.allergies, excluded.allergies),
        conditions  = coalesce(public.clinical_records.conditions, excluded.conditions),
        medications = coalesce(public.clinical_records.medications, excluded.medications),
        blood_type  = coalesce(public.clinical_records.blood_type, excluded.blood_type);

  update public.declared_records
     set reviewed_at = now(), reviewed_by = (select auth.uid())
   where patient_id = p_paciente;
end;
$$;

revoke all on function public.aceptar_datos_declarados(uuid) from public;
grant execute on function public.aceptar_datos_declarados(uuid) to authenticated;
