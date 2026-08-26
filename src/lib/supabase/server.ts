import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { requireSupabaseEnv } from './env'

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 * La sesión vive en cookies, así que RLS aplica con el usuario que esté logueado.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component: refrescar la sesión es trabajo del middleware.
        }
      },
    },
  })
}
