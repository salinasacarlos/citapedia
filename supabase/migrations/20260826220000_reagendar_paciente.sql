-- CitaPedia — el paciente mueve su propia cita.
--
-- Antes, si no podía ese día, su única salida era cancelar y volver a agendar
-- desde cero. En el camino perdía el lugar, así que lo más probable era que no
-- avisara y se convirtiera en una inasistencia — justo lo que la liga quería
-- evitar.
--
-- La cita nueva nace confirmada: el hueco ya estaba libre y a ese paciente el
-- consultorio ya lo había aceptado. Hacerlo esperar otra vez por mover su cita
-- dos horas sería peor que si hubiera cancelado.

/** Cuánto antes deja de poder moverla. Menos que esto es una inasistencia. */
create or replace function public.horas_minimas_para_reagendar()
returns int
language sql
immutable
as $$ select 12 $$;

create or replace function public.reagendar_cita_paciente(
  p_token  text,
  p_inicio timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  vieja public.appointments%rowtype;
  pro   public.professionals%rowtype;
  v_fin timestamptz;
  v_loc timestamp;
  v_token text;
begin
  select * into vieja from public.appointments where access_token = p_token;
  if not found then
    raise exception 'No encontramos esa cita.' using errcode = 'no_data_found';
  end if;

  if vieja.status <> 'confirmed' then
    raise exception 'Solo se puede mover una cita confirmada.' using errcode = 'check_violation';
  end if;

  if vieja.starts_at < now() + (public.horas_minimas_para_reagendar() || ' hours')::interval then
    raise exception 'Ya falta muy poco para tu cita. Habla al consultorio para moverla.'
      using errcode = 'check_violation';
  end if;

  if p_inicio = vieja.starts_at then
    raise exception 'Esa es la misma hora que ya tenías.' using errcode = 'check_violation';
  end if;

  select * into pro from public.professionals where id = vieja.professional_id;

  -- Conserva su duración: mover no es reconfigurar.
  v_fin := p_inicio + (vieja.ends_at - vieja.starts_at);
  v_loc := p_inicio at time zone pro.timezone;

  if p_inicio <= now() then
    raise exception 'Ese horario ya pasó.' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.availability a
     where a.professional_id = pro.id
       and a.weekday = extract(dow from v_loc)::int
       and v_loc::time >= a.start_time
       and (v_fin at time zone pro.timezone)::time <= a.end_time
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.time_blocks b
     where b.professional_id = pro.id
       and tstzrange(b.starts_at, b.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Ese horario no está disponible.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.appointments c
     where c.professional_id = pro.id
       and c.status = 'confirmed'
       and c.id <> vieja.id
       and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_inicio, v_fin)
  ) then
    raise exception 'Alguien acaba de tomar ese horario. Elige otro.'
      using errcode = 'check_violation';
  end if;

  -- La vieja y la nueva se enciman por un instante dentro de la transacción.
  set constraints public.appointments_no_overlap_when_confirmed deferred;

  insert into public.appointments
    (professional_id, patient_id, starts_at, ends_at, status, notes)
  values
    (vieja.professional_id, vieja.patient_id, p_inicio, v_fin, 'confirmed', vieja.notes)
  returning id, access_token into vieja.rescheduled_to, v_token;

  update public.appointments
     set status = 'rescheduled', rescheduled_to = vieja.rescheduled_to
   where id = vieja.id;

  -- Devuelve el token nuevo: el paciente sigue en su cita, ya movida.
  return v_token;
end;
$$;

-- `ver_cita` dice si todavía se puede mover, para no ofrecer un botón que
-- después va a rechazar. Agregar columnas al retorno obliga a soltarla antes.
drop function if exists public.ver_cita(text);

create or replace function public.ver_cita(p_token text)
returns table (
  cita_id          uuid,
  consultorio      text,
  slug             text,
  direccion        text,
  telefono         text,
  zona             text,
  paciente         text,
  inicio           timestamptz,
  fin              timestamptz,
  estado           public.appointment_status,
  confirmada_por_paciente boolean,
  ya_declaro       boolean,
  puede_reagendar  boolean,
  duracion_min     int
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.name, p.slug, p.clinic_address, p.phone, p.timezone,
         pa.name, c.starts_at, c.ends_at, c.status,
         c.patient_confirmed_at is not null,
         exists (select 1 from public.declared_records d where d.patient_id = pa.id),
         c.status = 'confirmed'
           and c.starts_at >= now() + (public.horas_minimas_para_reagendar() || ' hours')::interval,
         (extract(epoch from (c.ends_at - c.starts_at)) / 60)::int
    from public.appointments c
    join public.professionals p on p.id = c.professional_id
    left join public.patients pa on pa.id = c.patient_id
   where c.access_token = p_token;
$$;

revoke all on function public.reagendar_cita_paciente(text, timestamptz) from public;
grant execute on function public.reagendar_cita_paciente(text, timestamptz) to anon, authenticated;
grant execute on function public.ver_cita(text) to anon, authenticated;
