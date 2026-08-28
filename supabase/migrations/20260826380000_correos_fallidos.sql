-- Correos que no salieron.
--
-- Casi todos los envíos tienen a alguien mirando: la invitación y los avisos
-- de aceptar o rechazar fallan en pantalla, frente a la recepcionista. Dos no:
-- la recuperación de contraseña —que se calla a propósito, para no delatar qué
-- cuentas existen— y el cron de recordatorios, que corre de madrugada sin
-- nadie enfrente. Si Resend deja de entregar un martes, hoy nadie se entera
-- hasta que un paciente no llega.
--
-- **No se guarda a quién iba dirigido.** En recuperación la dirección es
-- justamente el dato que no debe quedar registrado —sería una lista de quién
-- tiene cuenta— y en recordatorios es el correo de un paciente. Lo accionable
-- es el motivo, que además casi siempre es global: "no hay dominio
-- verificado" no se arregla paciente por paciente.

create table public.email_failures (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  reason     text not null,
  created_at timestamptz default now()
);

alter table public.email_failures enable row level security;

-- Sin políticas: se escribe con la llave de servicio y se lee por una función
-- de plataforma. Nadie la toca por la API.
comment on table public.email_failures is
  'Envíos que Resend rechazó, sin destinatario: el motivo es lo accionable y '
  'la dirección es justo lo que no debe quedar registrado.';

create index email_failures_reciente_idx on public.email_failures (created_at desc);

/**
 * Cuántos correos no salieron últimamente, agrupados por motivo.
 *
 * La pregunta que contesta es "¿está saliendo el correo?", y por eso agrupa:
 * doscientos fallos del mismo motivo son un solo problema.
 */
create or replace function public.plataforma_correos_fallidos(p_dias int default 7)
returns table (kind text, reason text, cuantos int, ultimo timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.kind, f.reason, count(*)::int, max(f.created_at)
    from public.email_failures f
   where public.es_superadmin()
     and f.created_at > now() - (least(greatest(coalesce(p_dias, 7), 1), 90) || ' days')::interval
   group by f.kind, f.reason
   order by count(*) desc;
$$;

grant execute on function public.plataforma_correos_fallidos(int) to authenticated;
