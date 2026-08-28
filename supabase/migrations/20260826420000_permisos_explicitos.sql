-- Auditoría: quitar el EXECUTE que Postgres regala.
--
-- En Postgres **toda función nace con EXECUTE para PUBLIC**. Los
-- `grant execute ... to authenticated` que fuimos escribiendo eran redundantes:
-- nunca añadieron nada, porque el permiso ya estaba dado a todo el mundo. Hoy
-- `anon` —cuya llave es pública por diseño— puede llamar `plataforma_suspender`
-- y `plataforma_dar_permiso`.
--
-- No hay agujero abierto: cada una revisa `es_operador()`, y con `auth.uid()`
-- nulo eso es falso. Pero el modelo está al revés: la seguridad depende de que
-- nadie olvide nunca la revisión interna, en vez de depender de que nadie tenga
-- el permiso. La primera función que se escriba sin revisión queda expuesta a
-- cualquiera que tenga la llave publishable, que está en el HTML.
--
-- Se invierte: se revoca todo y se concede lo que de verdad tiene que llamarse
-- desde fuera, nombre por nombre.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       -- Las de btree_gist son internas de un índice, no superficie nuestra.
       and p.oid not in (
         select d.objid from pg_depend d
          join pg_extension e on e.oid = d.refobjid
         where d.deptype = 'e'
       )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end
$$;

-- ------------------------------------------------ lo que abre el público
--
-- Quien agenda o abre la liga de su cita no tiene sesión: estas son las únicas
-- que un anónimo necesita, y todas se identifican por token o por slug.

grant execute on function public.solicitar_cita(
  text, timestamptz, text, text, text, text, text, text, text, text
) to anon, authenticated;

grant execute on function public.ver_cita(text) to anon, authenticated;
grant execute on function public.confirmar_asistencia(text) to anon, authenticated;
grant execute on function public.cancelar_cita_paciente(text) to anon, authenticated;
grant execute on function public.reagendar_cita_paciente(text, timestamptz) to anon, authenticated;
grant execute on function public.declarar_datos_medicos(
  text, boolean, text, text, text, text
) to anon, authenticated;

-- La invitación se abre antes de tener cuenta; aceptarla ya exige sesión.
grant execute on function public.ver_invitacion(text) to anon, authenticated;

-- Predicados que evalúa el propio RLS, incluidas las políticas de Storage.
grant execute on function public.is_member(uuid) to anon, authenticated;
grant execute on function public.is_owner(uuid) to anon, authenticated;
grant execute on function public.uuid_o_null(text) to anon, authenticated;

-- ------------------------------------------- lo que necesita una sesión

grant execute on function public.aceptar_invitacion(text) to authenticated;
grant execute on function public.miembros_del_consultorio() to authenticated;
grant execute on function public.agendar_cita(uuid, timestamptz, int, text) to authenticated;
grant execute on function public.reagendar_cita(uuid, timestamptz) to authenticated;
grant execute on function public.aceptar_datos_declarados(uuid) to authenticated;
grant execute on function public.metricas_consultorio(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------ la consola de plataforma
--
-- Siguen revisando `es_superadmin()` / `es_operador()` por dentro: esto es la
-- segunda cerradura, no la única.

grant execute on function public.es_superadmin() to authenticated;
grant execute on function public.es_operador() to authenticated;
grant execute on function public.plataforma_consultorios() to authenticated;
grant execute on function public.plataforma_resumen() to authenticated;
grant execute on function public.plataforma_consultorio(uuid) to authenticated;
grant execute on function public.plataforma_equipo(uuid) to authenticated;
grant execute on function public.plataforma_citas(uuid, int) to authenticated;
grant execute on function public.plataforma_bitacora(uuid, int) to authenticated;
grant execute on function public.plataforma_correos_fallidos(int) to authenticated;
grant execute on function public.plataforma_operadores() to authenticated;
grant execute on function public.plataforma_suspender(uuid, text) to authenticated;
grant execute on function public.plataforma_reactivar(uuid) to authenticated;
grant execute on function public.plataforma_anotar(text, uuid, text) to authenticated;
grant execute on function public.plataforma_dar_permiso(text, public.platform_role) to authenticated;
grant execute on function public.plataforma_quitar_permiso(text) to authenticated;

-- `puede_recuperar` no se concede a nadie: la llama el servidor con la llave
-- de servicio, y desde fuera sería un oráculo de qué correos existen.
