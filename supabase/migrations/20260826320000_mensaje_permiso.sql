-- El mensaje hablaba de "soporte" a quien no es operador de nada.
--
-- La excepción la ve tanto un miembro de soporte —a quien la consola ya le
-- esconde el botón— como cualquiera que llame la función sin permiso. Decirle
-- "soporte puede ver, no suspender" a un médico cualquiera confunde y de paso
-- le cuenta cómo está organizada la plataforma.

create or replace function public.plataforma_suspender(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_operador() then
    raise exception 'Suspender cuentas es cosa de un fundador.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe por qué se suspende.' using errcode = 'check_violation';
  end if;

  update public.professionals
     set suspended_at = now(), suspended_reason = trim(p_motivo)
   where id = p_id;

  insert into public.platform_audit (actor_id, action, target_id, detail)
  values ((select auth.uid()), 'suspender', p_id, trim(p_motivo));
end;
$$;

create or replace function public.plataforma_reactivar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_operador() then
    raise exception 'Reactivar cuentas es cosa de un fundador.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.professionals
     set suspended_at = null, suspended_reason = null
   where id = p_id;

  insert into public.platform_audit (actor_id, action, target_id)
  values ((select auth.uid()), 'reactivar', p_id);
end;
$$;
