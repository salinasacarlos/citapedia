-- Llenar un campo vacío no es corregir nada.
--
-- El médico guarda la consulta en dos pasos —primero los signos vitales, luego
-- la nota— y al segundo guardado le aparecía "Se corrigió 1 vez", con el
-- tratamiento tachado como si lo hubiera borrado. No borró nada: agregó la
-- nota, y el historial guardó la versión anterior completa.
--
-- El historial existe para responder "¿no decía otra cosa?". Si antes no decía
-- nada, no hay nada que responder, y el renglón solo resta confianza en los
-- que sí importan. La NOM-004 pide que lo **asentado** quede íntegro; un campo
-- vacío no asentó nada.
--
-- Ojo con la regla: basta que UN campo con contenido cambie para que se guarde
-- la versión entera. Lo que se salta es únicamente el caso en que todo lo que
-- cambió venía vacío.

create or replace function public.guardar_version_de_nota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- ¿Se perdió algo que ya estaba escrito?
  piso boolean;
begin
  if tg_op = 'UPDATE' then
    piso := (old.note is not null and old.note is distinct from new.note)
         or (old.diagnosis is not null and old.diagnosis is distinct from new.diagnosis)
         or (old.treatment is not null and old.treatment is distinct from new.treatment)
         or (old.weight_kg is not null and old.weight_kg is distinct from new.weight_kg)
         or (old.height_cm is not null and old.height_cm is distinct from new.height_cm)
         or (old.temperature_c is not null and old.temperature_c is distinct from new.temperature_c)
         or (old.blood_pressure is not null and old.blood_pressure is distinct from new.blood_pressure)
         or (old.heart_rate is not null and old.heart_rate is distinct from new.heart_rate)
         or (old.oxygen_saturation is not null and old.oxygen_saturation is distinct from new.oxygen_saturation);

    -- Nada de lo que ya estaba escrito cambió: o no se tocó nada clínico, o
    -- solo se llenaron huecos. En ninguno de los dos casos hay qué conservar.
    if not piso then
      return new;
    end if;
  end if;

  insert into public.consultation_note_history (
    note_id, appointment_id, patient_id, professional_id,
    note, diagnosis, treatment, weight_kg, height_cm, temperature_c,
    blood_pressure, heart_rate, oxygen_saturation,
    author_id, written_at, replaced_by, motivo
  )
  values (
    old.id, old.appointment_id, old.patient_id, old.professional_id,
    old.note, old.diagnosis, old.treatment, old.weight_kg, old.height_cm,
    old.temperature_c, old.blood_pressure, old.heart_rate, old.oxygen_saturation,
    old.author_id, coalesce(old.updated_at, old.created_at),
    (select auth.uid()),
    case when tg_op = 'DELETE' then 'delete' else 'update' end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Los signos vitales también se corrigen.
--
-- El historial los guardaba pero la función no los devolvía, así que corregir
-- un peso creaba una versión que en pantalla salía **vacía**: "se corrigió" y
-- ningún campo debajo. Un historial que no dice qué cambió no sirve para lo
-- único que existe, que es responder "¿no decía otra cosa?".
drop function if exists public.historial_de_nota(uuid);

create or replace function public.historial_de_nota(p_cita uuid)
returns table (
  replaced_at       timestamptz,
  motivo            text,
  autor             text,
  note              text,
  diagnosis         text,
  treatment         text,
  weight_kg         numeric,
  height_cm         numeric,
  temperature_c     numeric,
  blood_pressure    text,
  heart_rate        int,
  oxygen_saturation int
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.replaced_at, h.motivo, u.email::text, h.note, h.diagnosis, h.treatment,
         h.weight_kg, h.height_cm, h.temperature_c, h.blood_pressure,
         h.heart_rate, h.oxygen_saturation
    from public.consultation_note_history h
    left join auth.users u on u.id = h.author_id
   where h.appointment_id = p_cita
     -- Es del expediente: la misma regla que la nota, solo el dueño.
     and public.is_owner(h.professional_id)
   order by h.replaced_at desc;
$$;

revoke execute on function public.historial_de_nota(uuid) from public, anon;
grant execute on function public.historial_de_nota(uuid) to authenticated;
