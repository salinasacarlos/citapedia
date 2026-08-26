-- Borra SOLO lo que sembró demo-consultorio.sql.
--
-- Se apoya en las marcas (@demo.citapedia.mx y el prefijo [demo]) para no
-- llevarse por delante un paciente real. Un `delete from patients` a secas sí
-- lo haría.

-- Se busca en los dos correos: al separar el contacto del tutor, el de los
-- pacientes menores se movió a `tutor_email` y este filtro dejó de
-- encontrarlos. Quedaron huérfanos hasta que chocaron con una siembra nueva.
delete from public.appointments
 where patient_id in (
   select id from public.patients
    where email like '%@demo.citapedia.mx' or tutor_email like '%@demo.citapedia.mx'
 );

delete from public.patients
 where email like '%@demo.citapedia.mx' or tutor_email like '%@demo.citapedia.mx';

delete from public.time_blocks where reason like '[demo]%';

select (select count(*) from public.patients)     as pacientes_restantes,
       (select count(*) from public.appointments) as citas_restantes;
