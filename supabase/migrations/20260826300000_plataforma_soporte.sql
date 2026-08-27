-- CitaPedia — la ficha de soporte de un consultorio.
--
-- La raya: la consola ve la OPERACIÓN, no el CONTENIDO. Fechas, horas,
-- estados y conteos, sí. Nombres de pacientes, teléfonos, correos y notas, no.
--
-- Para resolver "no me aparece una cita" basta con fecha, hora y estado. El
-- nombre del paciente no ayuda a diagnosticar y es dato de un tercero que no
-- es cliente de la plataforma. Por eso ninguna de estas funciones lo devuelve,
-- ni siquiera para el operador.

create or replace function public.plataforma_consultorio(p_id uuid)
returns table (
  id             uuid,
  name           text,
  slug           text,
  specialty      text,
  email          text,
  timezone       text,
  slot_duration  int,
  created_at     timestamptz,
  suspended_at   timestamptz,
  suspended_reason text,
  franjas        int,
  bloqueos       int,
  pacientes      int,
  -- El desglose responde casi todas las preguntas de soporte de un vistazo.
  solicitadas    int,
  confirmadas    int,
  atendidas      int,
  inasistencias  int,
  canceladas     int,
  recordatorios_horas int[],
  ultima_actividad timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.slug, p.specialty, p.email, p.timezone, p.slot_duration,
         p.created_at, p.suspended_at, p.suspended_reason,
         (select count(*)::int from public.availability a where a.professional_id = p.id),
         (select count(*)::int from public.time_blocks b where b.professional_id = p.id),
         (select count(*)::int from public.patients pa where pa.professional_id = p.id),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id and c.status = 'requested'),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id and c.status = 'confirmed'),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id and c.status = 'completed'),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id and c.status = 'no_show'),
         (select count(*)::int from public.appointments c
           where c.professional_id = p.id
             and c.status in ('cancelled_by_patient', 'cancelled_by_professional')),
         (select r.hours_before from public.reminder_settings r
           where r.professional_id = p.id),
         (select max(c.created_at) from public.appointments c where c.professional_id = p.id)
    from public.professionals p
   where p.id = p_id and public.es_superadmin();
$$;

grant execute on function public.plataforma_consultorio(uuid) to authenticated;

-- Quién tiene acceso y desde cuándo. Los correos son de miembros del equipo,
-- no de pacientes: son las personas con las que la plataforma trata.
create or replace function public.plataforma_equipo(p_id uuid)
returns table (
  email          text,
  rol            public.member_role,
  desde          timestamptz,
  ultimo_ingreso timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, m.role, m.created_at, u.last_sign_in_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where m.professional_id = p_id and public.es_superadmin()
   order by m.created_at;
$$;

grant execute on function public.plataforma_equipo(uuid) to authenticated;

-- Las últimas citas, SIN paciente. `tiene_paciente` distingue una cita
-- huérfana de una normal, que es lo único que hace falta para diagnosticar.
create or replace function public.plataforma_citas(p_id uuid, p_limite int default 20)
returns table (
  starts_at      timestamptz,
  ends_at        timestamptz,
  status         public.appointment_status,
  created_at     timestamptz,
  tiene_paciente boolean,
  confirmada_por_paciente boolean,
  recordatorio_enviado boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.starts_at, c.ends_at, c.status, c.created_at,
         c.patient_id is not null,
         c.patient_confirmed_at is not null,
         c.reminder_sent_at is not null
    from public.appointments c
   where c.professional_id = p_id and public.es_superadmin()
   order by c.created_at desc
   limit least(coalesce(p_limite, 20), 100);
$$;

grant execute on function public.plataforma_citas(uuid, int) to authenticated;

-- La bitácora, filtrable por consultorio.
drop function if exists public.plataforma_bitacora(int);
create or replace function public.plataforma_bitacora(
  p_target uuid default null,
  p_limite int default 50
)
returns table (
  created_at timestamptz,
  action     text,
  detail     text,
  target     text,
  actor      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.created_at, a.action, a.detail, p.name, u.email::text
    from public.platform_audit a
    left join public.professionals p on p.id = a.target_id
    left join auth.users u on u.id = a.actor_id
   where public.es_superadmin()
     and (p_target is null or a.target_id = p_target)
   order by a.created_at desc
   limit least(coalesce(p_limite, 50), 200);
$$;

grant execute on function public.plataforma_bitacora(uuid, int) to authenticated;
