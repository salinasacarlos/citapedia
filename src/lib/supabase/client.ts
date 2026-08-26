'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { requireSupabaseEnv } from './env'

/** Cliente de Supabase para componentes de cliente. */
export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
