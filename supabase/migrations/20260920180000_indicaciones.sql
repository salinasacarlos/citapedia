-- Lo que se toma y lo que se hace son dos cosas.
--
-- `treatment` se etiquetaba "Tratamiento indicado", y en español médico
-- "tratamiento" **es** la receta: el campo invitaba a escribir ahí justo lo que
-- `consultation_medications` volvía a pedir estructurado. El médico terminaba
-- capturando dos veces, o no capturando una.
--
-- La división que queda: lo que el paciente **toma** va en medicamentos —para
-- que se imprima ordenado y sea buscable—; lo que el paciente **hace** va
-- aquí: reposo, dieta, curaciones, qué vigilar.
--
-- La columna conserva su nombre a propósito. Renombrarla arrastraría el
-- historial clínico, su función y el Excel, y lo que confunde no es el nombre
-- de la columna sino la etiqueta que el médico lee.

comment on column public.consultation_notes.treatment is
  'Indicaciones NO farmacológicas: reposo, dieta, curaciones, qué vigilar. Lo '
  'que se receta vive en consultation_medications. Se llama treatment por '
  'historia; en pantalla dice "Indicaciones".';
