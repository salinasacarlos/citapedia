-- Avisar con una semana, y volver a avisar si nadie se movió.
--
-- Hasta hoy había un solo toque en cada caso: el recordatorio salía 24 h antes
-- de la cita, y el aviso el día que vencía. Los dos llegan tarde para lo que
-- el paciente tiene que hacer con ellos —pedir el día en el trabajo, o
-- conseguir hueco en la agenda— y si no reacciona, nadie vuelve a insistir.
--
-- Cada etapa lleva su propia marca y no un contador: así se sabe *cuál* salió
-- y cuándo, y una etapa que falle no arrastra a las demás.

alter table public.appointments
  add column if not exists reminder_early_sent_at timestamptz,
  add column if not exists reminder_final_sent_at timestamptz;

comment on column public.appointments.reminder_early_sent_at is
  'El aviso de la semana previa. Da tiempo a pedir permiso en el trabajo.';

comment on column public.appointments.reminder_final_sent_at is
  'El último jalón, el día de la cita, y SOLO si el paciente no ha confirmado.';

alter table public.patient_alerts
  add column if not exists early_sent_at timestamptz,
  add column if not exists followup_sent_at timestamptz;

comment on column public.patient_alerts.early_sent_at is
  'La semana previa: "ya casi le toca", con la liga para agendar.';

comment on column public.patient_alerts.followup_sent_at is
  'El segundo toque, y SOLO si para entonces no agendó nada.';

-- Un aviso se manda para que el paciente agende. Saber si ya lo hizo es la
-- única forma de no insistirle a quien ya hizo caso — y es la misma pregunta
-- que responde `controles_pendientes`, así que vive en la base y no en el cron.
create or replace function public.tiene_cita_por_venir(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
     where a.patient_id = p_paciente
       and a.status in ('requested', 'confirmed')
       and a.starts_at >= now()
  );
$$;

revoke execute on function public.tiene_cita_por_venir(uuid) from public, anon;
grant execute on function public.tiene_cita_por_venir(uuid) to authenticated, service_role;

-- Los índices siguen el mismo camino que las consultas nuevas del cron: por
-- estado y fecha, mirando solo lo que todavía no se ha mandado.
create index if not exists appointments_recordatorio_temprano_idx
  on public.appointments (starts_at)
  where status = 'confirmed' and reminder_early_sent_at is null;

create index if not exists patient_alerts_temprano_idx
  on public.patient_alerts (due_on)
  where status = 'pendiente' and early_sent_at is null;
