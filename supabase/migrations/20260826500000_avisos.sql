-- Avisos programados por paciente.
--
-- Distinto del recordatorio de cita, que cuelga de una cita y cuya fecha ya
-- existe. Un aviso cuelga del PACIENTE y su fecha se elige: "el 15 de marzo
-- recordarle la vacuna". Mezclarlos en la misma tabla sería forzar a inventar
-- una cita para cada aviso.
--
-- El destinatario es el contacto del paciente —su tutor si es menor, la misma
-- regla que todo lo demás— pero el aviso también se le muestra al consultorio
-- cuando vence: mientras no haya dominio verificado el correo no sale, y sin
-- eso el módulo entero no serviría de nada hasta entonces.

create table public.patient_alerts (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  due_on          date not null,
  titulo          text not null,
  mensaje         text,
  status          text not null default 'pendiente',
  sent_at         timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  constraint patient_alerts_status_valido
    check (status in ('pendiente', 'enviado', 'cancelado'))
);

alter table public.patient_alerts enable row level security;

-- `is_member` y no `is_owner`: el asistente es quien va a trabajar la lista y
-- mandar los mensajes. El contenido lo escribe el médico, pero alguien tiene
-- que poder actuar sobre él.
create policy patient_alerts_equipo on public.patient_alerts
  for all to authenticated
  using (public.is_member(professional_id))
  with check (public.is_member(professional_id));

-- La pregunta de todos los días: ¿qué vence hoy?
create index patient_alerts_pendientes_idx
  on public.patient_alerts (professional_id, due_on)
  where status = 'pendiente';

create index patient_alerts_paciente_idx on public.patient_alerts (patient_id);

comment on table public.patient_alerts is
  'Avisos programados por paciente. Su fecha se elige, al revés del '
  'recordatorio de cita, que la toma de la cita.';

/**
 * Los avisos que ya vencieron y nadie ha mandado.
 *
 * Con días de gracia, como los controles: un aviso de ayer sigue valiendo la
 * pena hoy.
 */
create or replace function public.avisos_pendientes(p_dias_de_gracia int default 15)
returns table (
  id         uuid,
  patient_id uuid,
  paciente   text,
  telefono   text,
  es_menor   boolean,
  tutor      text,
  due_on     date,
  titulo     text,
  mensaje    text
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.patient_id, p.name,
         coalesce(case when p.is_minor then p.tutor_phone else p.phone end, p.phone),
         coalesce(p.is_minor, false),
         case when p.is_minor then p.tutor_name end,
         a.due_on, a.titulo, a.mensaje
    from patient_alerts a
    join patients p on p.id = a.patient_id
   where a.status = 'pendiente'
     and a.due_on <= current_date + coalesce(p_dias_de_gracia, 15)
   order by a.due_on
$$;

grant execute on function public.avisos_pendientes(int) to authenticated;
