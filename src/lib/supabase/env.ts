/**
 * Lee la configuración de Supabase sin reventar si todavía no está puesta.
 *
 * La key pública viaja al browser y está pensada para eso: proyectos nuevos
 * usan `sb_publishable_...`; los viejos, la anon key en JWT. Aceptamos ambas.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, publishableKey, configured: Boolean(url && publishableKey) }
}

export function requireSupabaseEnv() {
  const { url, publishableKey } = supabaseEnv()
  if (!url || !publishableKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Copia .env.example a .env.local con los valores de tu proyecto.',
    )
  }
  return { url, publishableKey }
}
