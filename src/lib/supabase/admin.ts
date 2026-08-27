import { createClient as crear } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { requireSupabaseEnv } from './env'

/**
 * Cliente que salta RLS. Solo para trabajo sin usuario en sesión: hoy, el cron
 * de recordatorios, que tiene que mirar las citas de todos los consultorios.
 *
 * Nunca debe importarse desde un componente de cliente: la llave secreta se
 * queda en el servidor. Por eso se lee aquí y no se pasa por props.
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv()
  const llave = process.env.SUPABASE_SECRET_KEY

  if (!llave) {
    throw new Error(
      'Falta SUPABASE_SECRET_KEY. Es la llave de servicio de Supabase y solo ' +
        'vive en el servidor: ponla en .env.local y en Vercel, nunca en el repo.',
    )
  }

  return crear<Database>(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
