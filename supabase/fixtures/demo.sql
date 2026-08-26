-- CitaPedia — datos de prueba
-- 1 pediatra con página pública, horario semanal completo, pacientes
-- y citas en distintos estados para ver el flujo de inmediato.
-- Las fechas son relativas a "hoy": la semana pasada para el historial,
-- la semana que viene para la agenda.

do $$
declare
  pro_id       uuid;
  ana_id       uuid;
  luis_id      uuid;
  mateo_id     uuid;
  sofia_id     uuid;
  nueva_cita   uuid;
  prox_lunes   timestamptz := date_trunc('week', now()) + interval '7 days';
  lunes_pasado timestamptz := date_trunc('week', now()) - interval '7 days';
  d            int;
begin

  -- ------------------------------------------------------------ el médico
  insert into professionals (
    name, email, specialty, phone, clinic_address, slug, bio, photo_url,
    theme, consultation_info, slot_duration
  ) values (
    'Dra. Mariana Cordero',
    'mariana.cordero@citapedia.com',
    'Pediatría',
    '+52 55 1234 5678',
    'Av. Insurgentes Sur 1234, Consultorio 302, Col. Del Valle, CDMX',
    'dra-mariana-cordero',
    'Pediatra con 12 años de experiencia. Egresada de la UNAM con especialidad '
    || 'en el Hospital Infantil de México. Atiendo control del niño sano, '
    || 'vacunación, problemas respiratorios y seguimiento del desarrollo.',
    'https://images.citapedia.com/demo/mariana-cordero.jpg',
    'default',
    'Primera consulta 45 min, seguimiento 30 min. Trae la cartilla de '
    || 'vacunación y estudios previos. Hay estacionamiento en el edificio.',
    30
  )
  returning id into pro_id;

  -- ------------------------------------------- horario semanal recurrente
  -- Lunes a viernes: 09:00–13:00 y 16:00–19:00
  for d in 1..5 loop
    insert into availability (professional_id, weekday, start_time, end_time)
    values (pro_id, d, '09:00', '13:00'),
           (pro_id, d, '16:00', '19:00');
  end loop;
  -- Sábado: solo matutino
  insert into availability (professional_id, weekday, start_time, end_time)
  values (pro_id, 6, '09:00', '13:00');

  -- --------------------------------------------------------- un bloqueo
  insert into time_blocks (professional_id, starts_at, ends_at, reason)
  values (pro_id,
          prox_lunes + interval '3 days' + interval '11 hours',
          prox_lunes + interval '3 days' + interval '13 hours',
          'Junta médica del hospital');

  -- ------------------------------------------------------- recordatorios
  insert into reminder_settings (professional_id, channel, hours_before)
  values (pro_id, 'email', '{24,2}');

  -- ---------------------------------------------------------- pacientes
  insert into patients (name, phone, email) values
    ('Ana Reyes',      '+52 55 2222 1111', 'ana.reyes@example.com')    returning id into ana_id;
  insert into patients (name, phone, email) values
    ('Luis Márquez',   '+52 55 3333 2222', 'luis.marquez@example.com') returning id into luis_id;
  insert into patients (name, phone, email) values
    ('Mateo Villalba', '+52 55 4444 3333', 'mateo.v@example.com')      returning id into mateo_id;
  insert into patients (name, phone, email) values
    ('Sofía Duarte',   '+52 55 5555 4444', 'sofia.duarte@example.com') returning id into sofia_id;

  -- --------------------------------------------------------------- citas

  -- Bandeja de solicitudes: dos pendientes de aprobación, una compitiendo
  -- por el mismo hueco que otra (permitido mientras no se confirmen ambas).
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro_id, ana_id,
     prox_lunes + interval '9 hours', prox_lunes + interval '9 hours 30 minutes',
     'requested', 'Tos y fiebre desde el fin de semana.'),
    (pro_id, luis_id,
     prox_lunes + interval '9 hours', prox_lunes + interval '9 hours 30 minutes',
     'requested', 'Control del niño sano, 8 meses.'),
    (pro_id, mateo_id,
     prox_lunes + interval '16 hours 30 minutes', prox_lunes + interval '17 hours',
     'requested', 'Revisión de alergia.');

  -- Confirmadas: aquí sí se disparan recordatorios.
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro_id, sofia_id,
     prox_lunes + interval '1 day' + interval '10 hours',
     prox_lunes + interval '1 day' + interval '10 hours 30 minutes',
     'confirmed', 'Segunda dosis de vacuna.'),
    (pro_id, ana_id,
     prox_lunes + interval '2 days' + interval '17 hours',
     prox_lunes + interval '2 days' + interval '17 hours 30 minutes',
     'confirmed', null);

  -- Rechazada por el consultorio.
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro_id, mateo_id,
     prox_lunes + interval '4 days' + interval '12 hours',
     prox_lunes + interval '4 days' + interval '12 hours 30 minutes',
     'rejected', 'Fuera del área de atención, se refirió a otro colega.');

  -- Historial de la semana pasada.
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, notes) values
    (pro_id, luis_id,
     lunes_pasado + interval '2 days' + interval '11 hours',
     lunes_pasado + interval '2 days' + interval '11 hours 30 minutes',
     'completed', 'Peso y talla en percentil 60. Siguiente control en 3 meses.'),
    (pro_id, sofia_id,
     lunes_pasado + interval '4 days' + interval '16 hours',
     lunes_pasado + interval '4 days' + interval '16 hours 30 minutes',
     'no_show', null),
    (pro_id, ana_id,
     lunes_pasado + interval '3 days' + interval '9 hours 30 minutes',
     lunes_pasado + interval '3 days' + interval '10 hours',
     'cancelled_by_patient', 'La mamá avisó por teléfono.');

  -- Reagendada: la cita vieja se cierra y apunta a la nueva.
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, notes)
  values (pro_id, mateo_id,
          prox_lunes + interval '5 days' + interval '10 hours',
          prox_lunes + interval '5 days' + interval '10 hours 30 minutes',
          'confirmed', 'Reagendada desde el jueves.')
  returning id into nueva_cita;

  insert into appointments (professional_id, patient_id, starts_at, ends_at, status, rescheduled_to, notes)
  values (pro_id, mateo_id,
          prox_lunes + interval '3 days' + interval '9 hours',
          prox_lunes + interval '3 days' + interval '9 hours 30 minutes',
          'rescheduled', nueva_cita, 'La familia pidió cambiar al sábado.');

  -- Nadie la atendió a tiempo.
  insert into appointments (professional_id, patient_id, starts_at, ends_at, status) values
    (pro_id, sofia_id,
     lunes_pasado + interval '1 day' + interval '17 hours 30 minutes',
     lunes_pasado + interval '1 day' + interval '18 hours',
     'expired');

  -- Si ya existe un usuario en auth (te registraste en local), lo hacemos
  -- owner de esta consulta para poder entrar al admin con la demo cargada.
  insert into memberships (professional_id, user_id, role)
  select pro_id, u.id, 'owner' from auth.users u order by u.created_at limit 1
  on conflict do nothing;

end $$;
