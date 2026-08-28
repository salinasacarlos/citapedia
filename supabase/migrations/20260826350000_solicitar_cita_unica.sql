-- Quita la versión vieja de `solicitar_cita`.
--
-- `create or replace function` con distinta cantidad de parámetros no
-- reemplaza: crea una SOBRECARGA. Al agregarle `p_origen` y `p_referido`
-- quedaron dos funciones, y cualquier llamada con los ocho argumentos de antes
-- se vuelve ambigua —"function is not unique"— porque los dos nuevos tienen
-- default y las dos firmas encajan.
--
-- Se cae del lado seguro: se borra la vieja y queda una sola.

drop function if exists public.solicitar_cita(
  text, timestamptz, text, text, text, text, text, text
);
