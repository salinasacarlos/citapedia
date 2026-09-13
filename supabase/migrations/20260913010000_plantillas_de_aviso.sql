-- Fase 4 del post-venta: plantillas de aviso del consultorio.
--
-- La fase 3 dejó los avisos por paciente, uno por uno. Eso alcanza para un
-- caso suelto, pero "a los 6 meses le tocan vacunas" se lo dice el pediatra a
-- todos sus pacientes, y escribirlo de nuevo en cada ficha es como termina
-- puesto en unos sí y en otros no.
--
-- La plantilla guarda el texto y **desde dónde se cuenta la fecha**, que es la
-- diferencia con un aviso suelto: no lleva una fecha, lleva una regla.

create table public.alert_templates (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  titulo          text not null,
  mensaje         text,
  -- Desde dónde se cuenta: el nacimiento del paciente, su última visita, o hoy.
  base            text not null default 'nacimiento',
  offset_meses    int not null default 0,
  created_at      timestamptz default now(),
  constraint alert_templates_base_valida
    check (base in ('nacimiento', 'ultima_visita', 'hoy')),
  -- Veinte años: más allá de eso no es una plantilla, es un error de dedo.
  constraint alert_templates_offset_sensato
    check (offset_meses between 0 and 240),
  constraint alert_templates_titulo_no_vacio
    check (length(trim(titulo)) > 0)
);

alter table public.alert_templates enable row level security;

create index alert_templates_professional_id_idx
  on public.alert_templates (professional_id);

-- De equipo, igual que `patient_alerts`: quien trabaja la lista de avisos es
-- quien va a querer una plantilla para no escribir lo mismo cada vez.
create policy alert_templates_equipo on public.alert_templates
  for all to authenticated
  using (public.is_member(professional_id))
  with check (public.is_member(professional_id));

comment on table public.alert_templates is
  'Avisos que el consultorio repite. Guardan la regla de la fecha, no la fecha.';

comment on column public.alert_templates.base is
  'Desde dónde se cuentan los meses: nacimiento, última visita atendida, u hoy.';

-- Qué día caería esta plantilla para este paciente.
--
-- Se calcula en la base y no en la aplicación porque la misma cuenta la
-- necesitan dos lugares —la pantalla, para enseñar la fecha antes de aplicar,
-- y el guardado— y dos copias de una cuenta de fechas terminan discrepando.
create or replace function public.fecha_de_plantilla(p_plantilla uuid, p_paciente uuid)
returns date
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  t      alert_templates%rowtype;
  origen date;
begin
  select * into t from alert_templates where id = p_plantilla;
  if not found then return null; end if;

  if t.base = 'nacimiento' then
    select birth_date into origen from patients where id = p_paciente;
  elsif t.base = 'ultima_visita' then
    select max(starts_at)::date into origen
      from appointments
     where patient_id = p_paciente and status = 'completed';
  else
    origen := current_date;
  end if;

  -- Sin fecha de origen no hay cuenta que hacer: un recién llegado sin fecha
  -- de nacimiento no puede tener un aviso "a los 6 meses".
  if origen is null then return null; end if;

  return origen + (t.offset_meses || ' months')::interval;
end;
$$;

revoke execute on function public.fecha_de_plantilla(uuid, uuid) from public, anon;
grant execute on function public.fecha_de_plantilla(uuid, uuid) to authenticated;

-- Aplica la plantilla a un paciente: crea el aviso con la fecha ya calculada.
create or replace function public.aplicar_plantilla(p_plantilla uuid, p_paciente uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  t      alert_templates%rowtype;
  cuando date := public.fecha_de_plantilla(p_plantilla, p_paciente);
  nuevo  uuid;
begin
  select * into t from alert_templates where id = p_plantilla;
  if not found then
    raise exception 'Esa plantilla ya no existe.' using errcode = 'no_data_found';
  end if;

  if cuando is null then
    raise exception 'A este paciente le falta la fecha desde la que se cuenta este aviso.'
      using errcode = 'check_violation';
  end if;

  -- El cron manda todo lo que vence hoy o antes, así que un aviso con fecha
  -- pasada saldría mañana por la mañana. Aplicarle "a los 6 meses" a un niño
  -- de cuatro años le mandaría al día siguiente un correo de vacunas que le
  -- tocaban en 2022.
  if cuando < current_date then
    raise exception 'Esa fecha ya pasó (%): el aviso saldría de inmediato.', cuando
      using errcode = 'check_violation';
  end if;

  insert into patient_alerts (professional_id, patient_id, due_on, titulo, mensaje, created_by)
  values (t.professional_id, p_paciente, cuando, t.titulo, t.mensaje, (select auth.uid()))
  returning id into nuevo;

  return nuevo;
end;
$$;

revoke execute on function public.aplicar_plantilla(uuid, uuid) from public, anon;
grant execute on function public.aplicar_plantilla(uuid, uuid) to authenticated;
