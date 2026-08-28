-- CitaPedia — de dónde llegó el paciente.
--
-- La pregunta que esto contesta es "¿en qué vale la pena invertir?", y por eso
-- las opciones son las que se pueden accionar distinto:
--
--   `paciente`   otro paciente lo recomendó → hay a quién agradecerle
--   `medico`     otro médico lo refirió     → es una relación que se cultiva
--   `internet`   buscó y encontró           → SEO y la página pública
--   `redes`      Instagram, Facebook, TikTok
--   `directorio` Doctoralia y similares     → se paga, así que se mide aparte
--   `seguro`     llegó por su aseguradora o convenio
--   `paso`       vio el consultorio al pasar → letrero y ubicación
--   `otro`       lo demás
--
-- Se separa `medico` de `paciente` porque no son la misma inversión: a un
-- colega que refiere se le llama, a un paciente que recomienda se le agradece.
-- Y `directorio` se separa de `internet` porque uno se paga y el otro no.

alter table public.patients
  add column source      text,
  add column referred_by text;

alter table public.patients
  add constraint patients_source_valido
  check (
    source is null
    or source in ('paciente', 'medico', 'internet', 'redes', 'directorio',
                  'seguro', 'paso', 'otro')
  );

comment on column public.patients.source is
  'Cómo llegó el paciente. Null = no se preguntó, que es distinto de "otro".';

comment on column public.patients.referred_by is
  'Quién lo recomendó, cuando aplica. Texto libre: puede ser un paciente que '
  'no está en el sistema o un médico de otro consultorio.';

-- La pregunta de todos los meses es "¿de dónde llegaron los de este periodo?".
create index patients_source_idx on public.patients (professional_id, source);
