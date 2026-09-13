-- El medicamento recetado, con estructura.
--
-- Hasta hoy la receta vivía dentro de `treatment`, texto libre. Eso está bien
-- para "reposo y líquidos" y mal para lo que después hay que poder buscar:
-- qué se le dio, cuánto, cada cuándo y por cuántos días. Con texto libre, la
-- pregunta "¿a quién le receté amoxicilina?" no tiene respuesta.
--
-- **No reemplaza a `treatment`.** El médico sigue escribiendo lo que quiera
-- ahí; esto es un agregado opcional. Obligar a estructurar con el paciente
-- enfrente es cómo un campo deja de llenarse, y un campo que no se llena no
-- existe.

create table public.consultation_medications (
  id                   uuid primary key default gen_random_uuid(),
  consultation_note_id uuid not null references public.consultation_notes(id) on delete cascade,
  professional_id      uuid not null references public.professionals(id) on delete cascade,
  medicamento          text not null,
  dosis                text,
  frecuencia           text,
  duracion             text,
  indicaciones         text,
  prescribed_by        uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  -- Suspender un medicamento es un hecho clínico, no un borrado: hay que poder
  -- ver que se dio y que después se retiró.
  archived_at          timestamptz,
  archived_reason      text,
  constraint consultation_medications_nombre_no_vacio
    check (length(trim(medicamento)) > 0)
);

alter table public.consultation_medications enable row level security;

create index consultation_medications_note_idx
  on public.consultation_medications (consultation_note_id);

-- Solo dueño, igual que la nota de la que cuelga: una receta es tan clínica
-- como una alergia, y `is_member` le abriría el expediente al asistente.
create policy consultation_medications_owner on public.consultation_medications
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

-- NOM-004 otra vez: lo asentado no se altera en silencio.
--
-- Las notas guardan sus versiones anteriores en una tabla de historial. Aquí
-- se resuelve al revés y más simple: **la fila no se puede reescribir**. Lo
-- único editable es el retiro. Corregir una receta es retirarla y escribir la
-- correcta, y las dos quedan a la vista — que es justo lo que un expediente
-- tiene que poder mostrar.
create or replace function public.recetas_no_se_reescriben()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.medicamento is distinct from old.medicamento
     or new.dosis is distinct from old.dosis
     or new.frecuencia is distinct from old.frecuencia
     or new.duracion is distinct from old.duracion
     or new.indicaciones is distinct from old.indicaciones
     or new.consultation_note_id is distinct from old.consultation_note_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Una receta no se corrige encima: retírala y escribe la nueva.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger consultation_medications_inmutable
  before update on public.consultation_medications
  for each row execute function public.recetas_no_se_reescriben();

comment on table public.consultation_medications is
  'Lo recetado en una consulta, con estructura. Complementa treatment, no lo '
  'sustituye. Las filas no se reescriben: se retiran y se escribe otra.';

-- Lo recetado a un paciente, de la más reciente a la más vieja.
--
-- Responde la pregunta que el texto libre no podía: qué trae encima hoy, y qué
-- se le ha dado antes. Va con INVOKER: son los datos del propio médico y el
-- RLS de arriba ya decide cuáles son suyos.
create or replace function public.recetas_del_paciente(p_paciente uuid)
returns table (
  id           uuid,
  medicamento  text,
  dosis        text,
  frecuencia   text,
  duracion     text,
  indicaciones text,
  cuando       timestamptz,
  retirada     boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.medicamento, m.dosis, m.frecuencia, m.duracion, m.indicaciones,
         m.created_at, m.archived_at is not null
    from consultation_medications m
    join consultation_notes n on n.id = m.consultation_note_id
   where n.patient_id = p_paciente
   order by m.created_at desc;
$$;

revoke execute on function public.recetas_del_paciente(uuid) from public, anon;
grant execute on function public.recetas_del_paciente(uuid) to authenticated;
