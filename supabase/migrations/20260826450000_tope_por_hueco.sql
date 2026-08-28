-- Auditoría: acotar el desde la página pública.
--
-- Ya existía un tope de 3 solicitudes pendientes por contacto, pero se apoya en
-- el teléfono y el correo que teclea quien agenda: cambiarlos en cada intento lo
-- salta. Hoy nada impide llenar la pantalla de Solicitudes con cientos de
-- peticiones falsas.
--
-- El tope nuevo es **por hueco**, y esa elección importa:
--
-- - Un tope global por consultorio sería un arma: quien quisiera hacer daño lo
--   llenaría y dejaría al consultorio sin poder recibir citas de verdad. La
--   defensa se volvería el ataque.
-- - Por hueco, el daño queda acotado a (huecos publicados × 5) y un paciente
--   real siempre puede pedir cualquier otro horario.
--
-- Esto **acota el daño, no detiene a alguien decidido**: un ataque en serio se
-- para antes de llegar a la base, con límites por IP en el borde. Lo que evita
-- es que un script tonto o un formulario en bucle inutilicen la pantalla.

create or replace function public.tope_de_solicitudes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_en_el_hueco int;
begin
  if new.status <> 'requested' then
    return new;
  end if;

  select count(*) into v_en_el_hueco
    from public.appointments c
   where c.professional_id = new.professional_id
     and c.starts_at = new.starts_at
     and c.status = 'requested';

  -- Cinco personas peleándose el mismo hueco ya es mucho: la sexta no aporta
  -- información al consultorio, solo ruido.
  if v_en_el_hueco >= 5 then
    raise exception 'Ese horario ya tiene varias solicitudes. Elige otro.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_tope_solicitudes on public.appointments;
create trigger appointments_tope_solicitudes
  before insert on public.appointments
  for each row execute function public.tope_de_solicitudes();

-- El trigger cuenta por (consultorio, hueco, estado) en cada solicitud: sin
-- índice, eso es un recorrido de la tabla en el camino más público que hay.
create index if not exists appointments_solicitudes_por_hueco_idx
  on public.appointments (professional_id, starts_at)
  where status = 'requested';
