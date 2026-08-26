-- El correo de cada miembro vive en auth.users, fuera del alcance de RLS.
-- Esta función lo expone SOLO para los consultorios de los que quien pregunta
-- ya es miembro: no sirve para husmear en otros equipos.
create or replace function public.miembros_del_consultorio()
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  rol           public.member_role,
  desde         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, u.email, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where m.professional_id in (
     select m2.professional_id
       from public.memberships m2
      where m2.user_id = (select auth.uid())
   )
   order by m.role, m.created_at;
$$;

revoke all on function public.miembros_del_consultorio() from public;
grant execute on function public.miembros_del_consultorio() to authenticated;
