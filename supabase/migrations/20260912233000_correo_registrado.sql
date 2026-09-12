-- Para que la pantalla de la invitación ofrezca el botón correcto.
--
-- Quien abre la liga y ya tenía cuenta le picaba a "Crear mi cuenta" —que es
-- lo que dice el botón grande— y chocaba con "Ese correo ya tiene cuenta".
-- El mensaje era cierto pero dejaba sin salida a alguien que apenas está
-- entrando al sistema.
--
-- Se concede **solo a `service_role`**: saber si una dirección tiene cuenta es
-- justo lo que una pantalla pública no debe poder preguntar a voluntad. Aquí
-- la pregunta la hace el servidor, y únicamente sobre el correo que ya venía
-- escrito en una invitación válida.
create or replace function public.correo_registrado(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u where lower(u.email) = lower(trim(p_email))
  );
$$;

revoke execute on function public.correo_registrado(text) from public, anon, authenticated;
grant execute on function public.correo_registrado(text) to service_role;
