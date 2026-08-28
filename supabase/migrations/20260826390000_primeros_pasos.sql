-- Los primeros pasos se pueden ocultar a mano.
--
-- La lista se apaga sola conforme se completan los pasos, así que esta columna
-- es para el caso que no se puede deducir: alguien que ya sabe usarla y no
-- quiere la guía, aunque le falte algún paso a propósito —un médico que
-- trabaja solo y nunca va a invitar asistente, por ejemplo.

alter table public.professionals
  add column onboarding_hidden_at timestamptz;

comment on column public.professionals.onboarding_hidden_at is
  'Cuándo pidió no volver a ver los primeros pasos. Null = todavía se muestran.';
