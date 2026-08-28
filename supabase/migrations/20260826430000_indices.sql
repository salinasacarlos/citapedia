-- Auditoría: índices que faltaban.
--
-- Dos grupos, por dos razones distintas.
--
-- 1. **Claves foráneas sin índice.** Postgres no las indexa solo. Cada `delete`
--    del lado padre —borrar un paciente, un consultorio— obliga a un recorrido
--    completo de la tabla hija para saber qué arrastra. Con un consultorio de
--    prueba no se nota; con cien mil citas, borrar un paciente se sienta.
--
-- 2. **El camino caliente de la agenda.** Casi toda consulta de citas filtra por
--    consultorio y estado, y ordena por fecha. Había `(professional_id,
--    starts_at)` y `(status)` por separado, así que Postgres elegía uno y
--    filtraba el resto a mano.

-- ---------------------------------------------------- claves foráneas

create index if not exists appointments_patient_idx
  on public.appointments (patient_id);
create index if not exists appointments_rescheduled_to_idx
  on public.appointments (rescheduled_to);
create index if not exists clinical_records_professional_idx
  on public.clinical_records (professional_id);
create index if not exists consultation_files_professional_idx
  on public.consultation_files (professional_id);
create index if not exists consultation_files_appointment_idx
  on public.consultation_files (appointment_id);
create index if not exists consultation_notes_professional_idx
  on public.consultation_notes (professional_id);
create index if not exists declared_records_professional_idx
  on public.declared_records (professional_id);
create index if not exists platform_audit_target_idx
  on public.platform_audit (target_id);

-- ------------------------------------------------ el camino de la agenda
--
-- Sirve a la agenda, a solicitudes, al historial y a las métricas: todas
-- preguntan por consultorio, filtran por estado y ordenan por fecha.

create index if not exists appointments_agenda_idx
  on public.appointments (professional_id, status, starts_at);

-- El de solo `status` deja de aportar: con `professional_id` al frente, el
-- índice nuevo lo cubre, y uno de más se mantiene en cada escritura.
drop index if exists public.appointments_status_idx;
