-- La bitácora también recoge las altas.
--
-- Crear un consultorio se hace con la llave de servicio desde el servidor
-- (crear un usuario de auth no se puede desde SQL), pero la constancia se
-- escribe por aquí: así el único camino a `platform_audit` sigue siendo una
-- función que verifica quién llama.

create or replace function public.plataforma_anotar(
  p_action text,
  p_target uuid,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_superadmin() then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.platform_audit (actor_id, action, target_id, detail)
  values ((select auth.uid()), p_action, p_target, nullif(trim(p_detail), ''));
end;
$$;

grant execute on function public.plataforma_anotar(text, uuid, text) to authenticated;
