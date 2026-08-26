-- CitaPedia — estudios y documentos del expediente.
--
-- Una radiografía, un laboratorio o una receta escaneada son parte del
-- expediente, así que valen la misma regla que el resto de lo clínico: **solo
-- el dueño**. El asistente no los ve, igual que no ve las alergias.
--
--   expedientes/{professional_id}/{patient_id}/{timestamp}-{archivo}
--
-- El bucket es PRIVADO, al revés que `fotos-perfil`. Aquella foto se publica
-- en la página del médico; esto es un estudio de una persona identificada, y
-- una URL pública adivinable sería una filtración. Se leen con ligas firmadas
-- que se generan en el servidor y vencen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expedientes',
  'expedientes',
  false,
  20971520,                                            -- 20 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage guarda el archivo; esta tabla guarda qué es y de quién. Sin ella
-- habría que leer el nombre del archivo para saber de qué paciente es, y el
-- nombre lo pone quien sube.
create table public.consultation_files (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  -- Un estudio puede llegar entre consultas (el paciente lo manda después),
  -- así que la cita es opcional.
  appointment_id  uuid references public.appointments(id) on delete set null,
  path            text not null unique,
  filename        text not null,
  mime            text not null,
  size_bytes      int  not null,
  kind            text,
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

alter table public.consultation_files enable row level security;

create policy consultation_files_owner on public.consultation_files
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

create index consultation_files_patient_idx
  on public.consultation_files (patient_id, created_at desc);

comment on table public.consultation_files is
  'Estudios y documentos del expediente. Solo dueño, como el resto de lo clínico.';

-- Las políticas del bucket miran la primera carpeta, que es el consultorio.
-- `is_owner` y no `is_member`: el asistente no entra aquí.
drop policy if exists expedientes_lectura on storage.objects;
create policy expedientes_lectura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expedientes'
    and public.is_owner(public.uuid_o_null((storage.foldername(name))[1]))
  );

drop policy if exists expedientes_alta on storage.objects;
create policy expedientes_alta on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and public.is_owner(public.uuid_o_null((storage.foldername(name))[1]))
  );

drop policy if exists expedientes_baja on storage.objects;
create policy expedientes_baja on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expedientes'
    and public.is_owner(public.uuid_o_null((storage.foldername(name))[1]))
  );
