-- NOM-004: lo escrito en el expediente no se altera en silencio.
--
-- La norma del expediente clínico pide que lo asentado quede íntegro y que
-- cada nota diga quién la hizo y cuándo. Hoy `consultation_notes` se reescribe
-- con un `update`: el médico corrige un diagnóstico y la versión anterior
-- desaparece sin que quede rastro de que existió. Eso no es aceptable en un
-- expediente, y tampoco protege al médico —si alguien alega que "ahí decía otra
-- cosa", hoy no hay con qué responder.
--
-- No se bloquea la edición: corregir es normal y necesario. Lo que cambia es
-- que **cada versión anterior se guarda antes de perderse**.

create table public.consultation_note_history (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid not null,
  appointment_id  uuid not null,
  patient_id      uuid not null,
  professional_id uuid not null,
  -- Qué decía ANTES del cambio. No se guarda lo nuevo: eso ya está en la nota.
  note            text,
  diagnosis       text,
  treatment       text,
  weight_kg       numeric(6, 2),
  height_cm       numeric(6, 1),
  temperature_c   numeric(5, 1),
  blood_pressure  text,
  heart_rate      int,
  oxygen_saturation int,
  -- Quién la había escrito, y cuándo se reemplazó.
  author_id       uuid references auth.users(id) on delete set null,
  written_at      timestamptz,
  replaced_at     timestamptz not null default now(),
  replaced_by     uuid references auth.users(id) on delete set null,
  -- `delete` cuando la nota se borró entera, `update` cuando se corrigió.
  motivo          text not null
);

alter table public.consultation_note_history enable row level security;

-- Solo lectura, y solo del dueño: es tan clínico como la nota misma. **No hay
-- política de update ni de delete a propósito**: un historial que se puede
-- editar no es un historial.
create policy consultation_note_history_lectura on public.consultation_note_history
  for select to authenticated
  using (public.is_owner(professional_id));

create index consultation_note_history_nota_idx
  on public.consultation_note_history (appointment_id, replaced_at desc);

comment on table public.consultation_note_history is
  'Versiones anteriores de las notas de consulta. Solo se lee: se escribe por '
  'trigger y nadie la puede corregir, que es de lo que se trata.';

create or replace function public.guardar_version_de_nota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un update que no toca nada de lo clínico —por ejemplo solo `updated_at`—
  -- no genera versión: llenaría el historial de renglones idénticos.
  if tg_op = 'UPDATE' and (
       old.note is not distinct from new.note
       and old.diagnosis is not distinct from new.diagnosis
       and old.treatment is not distinct from new.treatment
       and old.weight_kg is not distinct from new.weight_kg
       and old.height_cm is not distinct from new.height_cm
       and old.temperature_c is not distinct from new.temperature_c
       and old.blood_pressure is not distinct from new.blood_pressure
       and old.heart_rate is not distinct from new.heart_rate
       and old.oxygen_saturation is not distinct from new.oxygen_saturation
     ) then
    return new;
  end if;

  insert into public.consultation_note_history (
    note_id, appointment_id, patient_id, professional_id,
    note, diagnosis, treatment, weight_kg, height_cm, temperature_c,
    blood_pressure, heart_rate, oxygen_saturation,
    author_id, written_at, replaced_by, motivo
  )
  values (
    old.id, old.appointment_id, old.patient_id, old.professional_id,
    old.note, old.diagnosis, old.treatment, old.weight_kg, old.height_cm,
    old.temperature_c, old.blood_pressure, old.heart_rate, old.oxygen_saturation,
    old.author_id, coalesce(old.updated_at, old.created_at),
    (select auth.uid()),
    case when tg_op = 'DELETE' then 'delete' else 'update' end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists consultation_notes_historial on public.consultation_notes;
create trigger consultation_notes_historial
  before update or delete on public.consultation_notes
  for each row execute function public.guardar_version_de_nota();

/** Lo que decía antes esta nota, para la pantalla de la consulta. */
create or replace function public.historial_de_nota(p_cita uuid)
returns table (
  replaced_at timestamptz,
  motivo      text,
  autor       text,
  note        text,
  diagnosis   text,
  treatment   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.replaced_at, h.motivo, u.email::text, h.note, h.diagnosis, h.treatment
    from public.consultation_note_history h
    left join auth.users u on u.id = h.author_id
   where h.appointment_id = p_cita
     -- Es del expediente: la misma regla que la nota, solo el dueño.
     and public.is_owner(h.professional_id)
   order by h.replaced_at desc;
$$;

grant execute on function public.historial_de_nota(uuid) to authenticated;
