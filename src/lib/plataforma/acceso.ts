import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Puerta de la consola de plataforma.
 *
 * Responde 404, no 403: quien no es operador no tiene por qué enterarse de
 * que esta sección existe. Y la respuesta de verdad no depende de esto — las
 * funciones de la base revisan `es_superadmin()` por su cuenta, así que saltar
 * esta pantalla no daría acceso a nada.
 */
export async function exigirSuperadmin() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('es_superadmin')
  if (error || data !== true) notFound()

  // Entrar y poder cambiar cosas son permisos distintos: soporte ve la
  // consola completa, pero no le apaga el negocio a nadie.
  const { data: operador } = await supabase.rpc('es_operador')

  return Object.assign(supabase, { esOperador: operador === true })
}
