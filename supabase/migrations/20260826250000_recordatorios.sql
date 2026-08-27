-- CitaPedia — recordatorios por correo.
--
-- La marca vive en la cita y no en una tabla aparte: la pregunta que hay que
-- responder mil veces al día es "¿a esta ya le avisé?", y esa es de la cita.
-- Una tabla de envíos se justificaría el día que haya varios recordatorios por
-- cita (72 h y 2 h, por ejemplo); hoy sería una junta de más en cada consulta.

alter table public.appointments
  add column reminder_sent_at timestamptz;

comment on column public.appointments.reminder_sent_at is
  'Cuándo salió el recordatorio automático. Null = todavía no. Distinto de '
  'confirmation_sent_at, que es el WhatsApp que manda la recepcionista a mano.';

-- El cron pregunta siempre lo mismo: citas confirmadas, próximas, sin avisar.
-- El índice parcial deja fuera el histórico completo, que es casi todo.
create index appointments_por_recordar_idx
  on public.appointments (starts_at)
  where status = 'confirmed' and reminder_sent_at is null;
