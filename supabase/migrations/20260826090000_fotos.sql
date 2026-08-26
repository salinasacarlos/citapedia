-- CitaPedia — foto de perfil subida directo, no pegada como liga.
--
-- Las fotos viven en un bucket público (aparecen en la página pública del
-- médico), pero escribir en él está restringido: cada consultorio solo puede
-- tocar su propia carpeta, que lleva su id.
--
--   fotos-perfil/{professional_id}/perfil-{timestamp}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil',
  'fotos-perfil',
  true,
  5242880,                                             -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Una carpeta con nombre inválido no debe reventar la política: devuelve null,
-- y is_member(null) es false.
create or replace function public.uuid_o_null(t text)
returns uuid
language plpgsql
immutable
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists fotos_perfil_lectura on storage.objects;
create policy fotos_perfil_lectura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fotos-perfil');

drop policy if exists fotos_perfil_alta on storage.objects;
create policy fotos_perfil_alta on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-perfil'
    and public.is_member(public.uuid_o_null((storage.foldername(name))[1]))
  );

drop policy if exists fotos_perfil_cambio on storage.objects;
create policy fotos_perfil_cambio on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and public.is_member(public.uuid_o_null((storage.foldername(name))[1]))
  );

drop policy if exists fotos_perfil_baja on storage.objects;
create policy fotos_perfil_baja on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and public.is_member(public.uuid_o_null((storage.foldername(name))[1]))
  );
