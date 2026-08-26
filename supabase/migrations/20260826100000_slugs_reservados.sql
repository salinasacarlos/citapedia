-- CitaPedia — slugs que la aplicación ya usa.
--
-- Las rutas estáticas de Next ganan sobre `/[slug]`: si un médico se queda con
-- el slug `admin` o `login`, su página pública queda inaccesible y nada avisa.
-- Se bloquea en la base para que aplique tanto al alta automática como a la
-- edición del perfil.

create or replace function public.slug_reservado(s text)
returns boolean
language sql
immutable
as $$
  select s = any (array[
    'admin', 'login', 'logout', 'registro', 'auth', 'api', 'app', 'www',
    'citapedia', 'cuenta', 'ayuda', 'soporte', 'contacto', 'blog', 'precios',
    'terminos', 'privacidad', 'legal', 'buscar', 'nuevo', 'static', 'assets',
    'favicon', 'robots', 'sitemap', 'well-known', 'next', 'vercel'
  ]);
$$;

-- Los que ya existan y choquen se corren con sufijo antes de poner la regla.
update public.professionals
   set slug = slug || '-consultorio'
 where public.slug_reservado(slug);

alter table public.professionals
  add constraint professionals_slug_no_reservado
  check (not public.slug_reservado(slug));

alter table public.professionals
  add constraint professionals_slug_largo
  check (char_length(slug) between 3 and 60);

-- El alta automática también debe esquivarlos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidato text;
  n         int := 1;
  pro_id    uuid;
begin
  if coalesce(new.raw_user_meta_data->>'signup_kind', 'professional') <> 'professional' then
    return new;
  end if;

  base := public.slugify(
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1))
  );
  -- Debe cumplir el largo mínimo aunque el nombre sea de dos letras.
  if coalesce(base, '') = '' or char_length(base) < 3 then
    base := 'consultorio';
  end if;
  base := left(base, 50);

  candidato := base;
  while exists (select 1 from public.professionals p where p.slug = candidato)
     or public.slug_reservado(candidato)
  loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;

  insert into public.professionals (name, email, specialty, slug)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), new.email),
    new.email,
    nullif(new.raw_user_meta_data->>'specialty', ''),
    candidato
  )
  returning id into pro_id;

  insert into public.memberships (professional_id, user_id, role)
  values (pro_id, new.id, 'owner');

  insert into public.reminder_settings (professional_id)
  values (pro_id);

  return new;
end;
$$;
