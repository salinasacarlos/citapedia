-- El papel membretado del médico, para imprimir recetas.
--
-- Cada consultorio ya tiene su receta impresa: logo, nombre, cédula
-- profesional, dirección, y a veces la firma escaneada. Eso es lo que hace
-- válida una receta, y es lo que CitaPedia no puede inventar — ni debe: la
-- cédula es un dato que nadie más que el médico puede afirmar.
--
-- Así que no se genera un diseño: se toma el suyo y se escribe encima.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'papel-receta',
  'papel-receta',
  false,                                               -- lleva su cédula y su firma
  5242880,                                             -- 5 MB
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada consultorio en su carpeta, como en los otros dos buckets.
create policy papel_receta_lee on storage.objects
  for select to authenticated
  using (
    bucket_id = 'papel-receta'
    and public.is_owner(nullif(split_part(name, '/', 1), '')::uuid)
  );

create policy papel_receta_escribe on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'papel-receta'
    and public.is_owner(nullif(split_part(name, '/', 1), '')::uuid)
  );

create policy papel_receta_borra on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'papel-receta'
    and public.is_owner(nullif(split_part(name, '/', 1), '')::uuid)
  );

-- Dónde puede escribir CitaPedia sin taparle el membrete.
--
-- La alternativa era un editor de coordenadas para colocar cada dato. Eso es
-- mucho trabajo para el médico y mucha superficie para nosotros: una hoja
-- membretada tiene el encabezado arriba, la firma abajo y el centro vacío.
-- Con dos números —cuánto respetar arriba y cuánto abajo— se acomoda cualquier
-- papel, y se puede ver en pantalla antes de imprimir.
create table public.prescription_paper (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  path            text not null,
  mime            text not null,
  margen_arriba   int  not null default 60,            -- milímetros
  margen_abajo    int  not null default 40,
  updated_at      timestamptz not null default now(),
  constraint prescription_paper_margenes_sensatos
    check (margen_arriba between 0 and 200 and margen_abajo between 0 and 200)
);

alter table public.prescription_paper enable row level security;

-- Solo dueño: es su cédula y su firma, no del equipo.
create policy prescription_paper_owner on public.prescription_paper
  for all to authenticated
  using (public.is_owner(professional_id))
  with check (public.is_owner(professional_id));

comment on table public.prescription_paper is
  'El papel membretado del consultorio y cuánto espacio respetarle arriba y '
  'abajo. CitaPedia escribe encima; lo que hace válida la receta es el papel.';
