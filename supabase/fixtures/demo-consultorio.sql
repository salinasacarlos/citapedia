-- CitaPedia — datos de demostración.
--
-- Siembra una semana creíble para CADA consultorio: pacientes, citas en
-- distintos estados, un bloqueo y horario si no lo tiene.
--
-- Todo lo demo queda marcado: los pacientes con correo @demo.citapedia.mx y
-- los bloqueos con el prefijo [demo]. Así `npm run demo:limpiar` puede borrar
-- exactamente esto y nada más — nunca un paciente real.
--
--   npm run demo:sembrar

-- Correrlo dos veces chocaba con las citas que ya había sembrado. Limpia lo
-- suyo primero: así se puede correr las veces que haga falta sin pensarlo.
delete from public.appointments
 where patient_id in (select id from public.patients where email like '%@demo.citapedia.mx');
delete from public.patients where email like '%@demo.citapedia.mx';
delete from public.time_blocks where reason like '[demo]%';

do $$
declare
  pro         public.professionals%rowtype;
  tz          text;
  lunes_prox  timestamp;
  lunes_ant   timestamp;
  ayer        timestamp;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  nueva uuid;
begin
for pro in select * from public.professionals loop
  tz := pro.timezone;

  -- Sin horario no hay agenda que mostrar.
  if not exists (select 1 from public.availability a where a.professional_id = pro.id) then
    insert into public.availability (professional_id, weekday, start_time, end_time)
    select pro.id, d, h.a, h.b
      from generate_series(1, 5) d,
           (values ('09:00'::time, '13:00'::time), ('16:00'::time, '19:00'::time)) as h(a, b);
    insert into public.availability (professional_id, weekday, start_time, end_time)
    values (pro.id, 6, '09:00', '13:00');
  end if;

  lunes_prox := date_trunc('week', (now() at time zone tz)) + interval '7 days';
  lunes_ant  := date_trunc('week', (now() at time zone tz)) - interval '7 days';
  ayer       := date_trunc('day',  (now() at time zone tz)) - interval '1 day';

  -- Mezcla de menores y adultos: la app sirve para ambos.
  insert into public.patients (professional_id, name, phone, email, birth_date, tutor_name, tutor_relationship) values
    (pro.id, 'Regina Ontiveros', '+52 55 1010 2020', 'regina@demo.citapedia.mx', '2021-06-18', 'Mariana Ontiveros', 'Madre') returning id into p1;
  insert into public.patients (professional_id, name, phone, email, birth_date, tutor_name, tutor_relationship) values
    (pro.id, 'Diego Alcántara',  '+52 55 3030 4040', 'diego@demo.citapedia.mx',  '2025-01-09', 'Sofía Alcántara', 'Madre') returning id into p2;
  insert into public.patients (professional_id, name, phone, email, birth_date) values
    (pro.id, 'Camila Fuentes',   '+52 55 5050 6060', 'camila@demo.citapedia.mx', '1989-03-22') returning id into p3;
  insert into public.patients (professional_id, name, phone, email, birth_date, tutor_name, tutor_relationship) values
    (pro.id, 'Bruno Salazar',    '+52 55 7070 8080', 'bruno@demo.citapedia.mx',  '2016-11-30', 'Andrés Salazar', 'Padre') returning id into p4;
  insert into public.patients (professional_id, name, phone, email, birth_date) values
    (pro.id, 'Valentina Ruiz',   '+52 55 9090 1010', 'valentina@demo.citapedia.mx', '1996-08-05') returning id into p5;
  insert into public.patients (professional_id, name, phone, email, birth_date, tutor_name, tutor_relationship) values
    (pro.id, 'Iker Montoya',     '+52 55 2020 3030', 'iker@demo.citapedia.mx',   '2013-02-14', 'Paola Montoya', 'Madre') returning id into p6;

  -- Bandeja: dos pacientes peleando el mismo hueco, más una suelta.
  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro.id, p1, (lunes_prox + time '09:00') at time zone tz,
                 (lunes_prox + time '09:30') at time zone tz, 'requested',
     'Tos seca desde hace cuatro días y fiebre por las noches.'),
    (pro.id, p2, (lunes_prox + time '09:00') at time zone tz,
                 (lunes_prox + time '09:30') at time zone tz, 'requested',
     'Control del niño sano, 8 meses.'),
    (pro.id, p3, (lunes_prox + interval '2 days' + time '17:00') at time zone tz,
                 (lunes_prox + interval '2 days' + time '17:30') at time zone tz, 'requested',
     'Revisión de alergia.');

  -- Agenda confirmada.
  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro.id, p4, (lunes_prox + interval '1 day' + time '10:00') at time zone tz,
                 (lunes_prox + interval '1 day' + time '10:30') at time zone tz, 'confirmed',
     'Segunda dosis de vacuna.'),
    (pro.id, p5, (lunes_prox + interval '3 days' + time '11:30') at time zone tz,
                 (lunes_prox + interval '3 days' + time '12:00') at time zone tz, 'confirmed', null);

  -- Ya pasó y sigue abierta: aparece en "Por cerrar".
  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro.id, p6, (ayer + time '11:00') at time zone tz,
                 (ayer + time '11:30') at time zone tz, 'confirmed',
     'Seguimiento de peso y talla.');

  -- Historial de la semana pasada, un desenlace de cada tipo.
  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro.id, p3, (lunes_ant + interval '1 day' + time '09:30') at time zone tz,
                 (lunes_ant + interval '1 day' + time '10:00') at time zone tz, 'completed',
     'Percentil 60. Siguiente control en 3 meses.'),
    (pro.id, p4, (lunes_ant + interval '2 days' + time '12:00') at time zone tz,
                 (lunes_ant + interval '2 days' + time '12:30') at time zone tz, 'no_show', null),
    (pro.id, p1, (lunes_ant + interval '3 days' + time '16:30') at time zone tz,
                 (lunes_ant + interval '3 days' + time '17:00') at time zone tz,
     'cancelled_by_professional', 'Se recorrió por una urgencia.'),
    (pro.id, p2, (lunes_ant + interval '4 days' + time '10:00') at time zone tz,
                 (lunes_ant + interval '4 days' + time '10:30') at time zone tz, 'rejected',
     'Fuera del área de atención.'),
    (pro.id, p5, (lunes_ant + interval '4 days' + time '17:30') at time zone tz,
                 (lunes_ant + interval '4 days' + time '18:00') at time zone tz, 'expired', null);

  -- Reagendada: la vieja apunta a la nueva.
  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, notes)
  values (pro.id, p6, (lunes_prox + interval '4 days' + time '09:30') at time zone tz,
                      (lunes_prox + interval '4 days' + time '10:00') at time zone tz,
          'confirmed', 'Reagendada desde el miércoles.')
  returning id into nueva;

  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, rescheduled_to, notes)
  values (pro.id, p6, (lunes_prox + interval '2 days' + time '09:30') at time zone tz,
                      (lunes_prox + interval '2 days' + time '10:00') at time zone tz,
          'rescheduled', nueva, 'La familia pidió cambiar de día.');

  -- Expediente de algunos: alergias y padecimientos que se ven en la ficha.
  insert into public.clinical_records (patient_id, professional_id, allergies, conditions, medications, blood_type)
  values
    (p1, pro.id, 'Penicilina', 'Asma leve', 'Salbutamol en crisis', 'O+'),
    (p4, pro.id, null, 'Rinitis alérgica estacional', null, 'A+'),
    (p3, pro.id, 'Sulfas', null, null, 'O-');

  -- Un bloqueo, para ver cómo se ve en el calendario.
  insert into public.time_blocks (professional_id, starts_at, ends_at, reason) values
    (pro.id, (lunes_prox + interval '2 days' + time '16:00') at time zone tz,
             (lunes_prox + interval '2 days' + time '19:00') at time zone tz,
     '[demo] Junta del hospital');
end loop;
end $$;

select p.slug,
       (select count(*) from public.appointments c where c.professional_id = p.id) as citas
  from public.professionals p order by p.created_at;
