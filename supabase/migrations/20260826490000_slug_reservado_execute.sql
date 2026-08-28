-- Devuelve el EXECUTE de `slug_reservado`, que la auditoría quitó de más.
--
-- La función vive dentro de un CHECK de `professionals.slug`, y **las
-- restricciones CHECK se evalúan con los privilegios de quien escribe**, no con
-- los del dueño de la tabla. Sin este permiso, un médico cambiando el slug de
-- su página recibía "permission denied for function slug_reservado" — el
-- barrido de permisos rompió una escritura legítima.
--
-- Lo detectó el harness de PGlite al crear un consultorio, no un usuario.
--
-- La lección para la próxima: al revocar EXECUTE hay que mirar también dónde se
-- usa la función, no solo quién la llama desde la aplicación. Los CHECK son el
-- caso que no salta a la vista; los triggers no, porque su permiso se revisa al
-- crearlos y no al dispararse.

grant execute on function public.slug_reservado(text) to anon, authenticated;
