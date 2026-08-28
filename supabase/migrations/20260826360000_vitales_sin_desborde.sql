-- Los signos vitales desbordaban antes de poder decir qué estaba mal.
--
-- `weight_kg` era numeric(5,2): tres dígitos enteros, tope 999.99. Capturar el
-- peso de un recién nacido en gramos —3500, que es lo natural en pediatría—
-- reventaba con "numeric field overflow", un error crudo de Postgres, en vez
-- de con el CHECK que ya existe y sí explica el problema.
--
-- El orden importa: el desbordamiento ocurre al convertir el valor, ANTES de
-- que se evalúe cualquier CHECK. Con más dígitos disponibles el valor entra,
-- el CHECK lo rechaza, y el mensaje que llega a la pantalla es el bueno.

alter table public.consultation_notes
  alter column weight_kg     type numeric(6, 2),
  alter column height_cm     type numeric(6, 1),
  alter column temperature_c type numeric(5, 1);

-- El expediente declarado y el verificado guardan las mismas medidas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'clinical_records' and column_name = 'weight_kg'
  ) then
    alter table public.clinical_records
      alter column weight_kg type numeric(6, 2);
  end if;
end
$$;
