-- El freno de recuperación tiene que consultarse ANTES de generar la liga.
--
-- `generateLink` invalida el token anterior en el momento en que se llama, así
-- que frenar después de llamarlo deja lo peor de los dos mundos: la liga que
-- ya se había mandado deja de servir y la nueva no sale. Quien pidió ayuda se
-- queda con una liga muerta en el buzón.
--
-- Esta función responde "¿puedo mandar otra?" sin revelar nada: para un correo
-- que no existe contesta que sí, igual que para uno que sí existe y ya esperó.
-- Quien la llame no puede distinguir un caso del otro.

create or replace function public.puede_recuperar(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from auth.users u
     where u.email = lower(trim(p_email))
       and u.recovery_sent_at is not null
       and u.recovery_sent_at > now() - interval '60 seconds'
  );
$$;

comment on function public.puede_recuperar(text) is
  'Freno contra el bombardeo de ligas de recuperación. Contesta lo mismo para '
  'un correo inexistente que para uno que ya esperó: no revela quién existe.';

-- Solo el servidor la llama, con la llave de servicio. No hace falta abrirla
-- a nadie más.
revoke execute on function public.puede_recuperar(text) from public, anon, authenticated;
