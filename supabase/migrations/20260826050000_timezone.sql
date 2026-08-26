-- La agenda se guarda en timestamptz (UTC), pero "las 9:00" significa las 9:00
-- del consultorio. Sin esto, un médico en Tijuana y otro en Cancún verían
-- horarios corridos, y los slots del paso 4 saldrían mal.
alter table public.professionals
  add column timezone text not null default 'America/Mexico_City';

-- CHECK no admite subconsultas, así que la zona se valida intentando usarla:
-- si el nombre no existe, Postgres levanta el error por su cuenta.
create or replace function public.validate_timezone()
returns trigger
language plpgsql
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Zona horaria desconocida: %', new.timezone
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists professionals_validate_timezone on public.professionals;
create trigger professionals_validate_timezone
  before insert or update of timezone on public.professionals
  for each row execute function public.validate_timezone();
