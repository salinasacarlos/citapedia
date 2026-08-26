-- CitaPedia — invitar a un asistente.
--
-- Quien recibe la invitación todavía NO es miembro, así que RLS le impide ver
-- la fila o crear su membresía. Las dos operaciones pasan por funciones con
-- permisos elevados que validan todo en un solo lugar.
--
-- La invitación queda atada al correo al que se mandó: reenviar la liga a un
-- tercero no le da acceso al expediente de un consultorio ajeno.

-- Solo lo que el invitado necesita ver para decidir. No devuelve el token ni
-- nada del consultorio más allá del nombre.
create or replace function public.ver_invitacion(p_token text)
returns table (
  consultorio text,
  email       text,
  rol         public.member_role,
  estado      text,
  vencida     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, i.email, i.role, i.status, i.expires_at < now()
    from public.invitations i
    join public.professionals p on p.id = i.professional_id
   where i.token = p_token;
$$;

create or replace function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv     public.invitations%rowtype;
  uid     uuid := (select auth.uid());
  correo  text;
begin
  if uid is null then
    raise exception 'Necesitas iniciar sesión para aceptar la invitación.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into inv from public.invitations where token = p_token;
  if not found then
    raise exception 'Esa invitación no existe.' using errcode = 'no_data_found';
  end if;

  if inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = inv.id;
    raise exception 'Esa invitación venció. Pídele a tu doctor que te mande otra.'
      using errcode = 'check_violation';
  end if;

  if inv.status <> 'pending' then
    raise exception 'Esa invitación ya se usó o fue cancelada.'
      using errcode = 'check_violation';
  end if;

  select u.email into correo from auth.users u where u.id = uid;
  if lower(correo) <> lower(inv.email) then
    raise exception 'Esta invitación es para %, y entraste como %.', inv.email, correo
      using errcode = 'check_violation';
  end if;

  -- Aceptar dos veces no debe romper nada: la segunda no hace daño.
  if exists (
    select 1 from public.memberships m
     where m.professional_id = inv.professional_id and m.user_id = uid
  ) then
    update public.invitations set status = 'accepted' where id = inv.id;
    return inv.professional_id;
  end if;

  insert into public.memberships (professional_id, user_id, role)
  values (inv.professional_id, uid, inv.role);

  update public.invitations set status = 'accepted' where id = inv.id;

  return inv.professional_id;
end;
$$;

revoke all on function public.ver_invitacion(text) from public;
revoke all on function public.aceptar_invitacion(text) from public;
grant execute on function public.ver_invitacion(text) to anon, authenticated;
grant execute on function public.aceptar_invitacion(text) to authenticated;

-- Una persona no puede tener dos veces la misma invitación viva.
create unique index invitations_pendiente_unica
  on public.invitations (professional_id, lower(email))
  where status = 'pending';
