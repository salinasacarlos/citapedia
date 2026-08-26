-- Resumen de cada paciente para la lista: total de citas, última visita y
-- próxima cita, sin que la aplicación tenga que pedirlas por separado.
--
-- security_invoker = true, al revés que las vistas públicas: aquí SÍ queremos
-- que aplique el RLS de patients, para que cada consultorio vea los suyos.
create view public.patients_resumen
with (security_invoker = true) as
  select p.id,
         p.professional_id,
         p.name,
         p.phone,
         p.email,
         p.birth_date,
         p.sex,
         p.tutor_name,
         p.tutor_phone,
         p.tutor_relationship,
         p.created_at,
         (select count(*) from public.appointments a where a.patient_id = p.id) as total_citas,
         (select count(*) from public.appointments a
           where a.patient_id = p.id and a.status = 'completed') as citas_atendidas,
         (select max(a.starts_at) from public.appointments a
           where a.patient_id = p.id and a.status = 'completed') as ultima_visita,
         (select min(a.starts_at) from public.appointments a
           where a.patient_id = p.id and a.status = 'confirmed'
             and a.starts_at > now()) as proxima_cita
    from public.patients p;

grant select on public.patients_resumen to authenticated;
