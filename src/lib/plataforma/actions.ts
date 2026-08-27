'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ResultadoPlataforma = { error?: string; ok?: string }

/**
 * Suspender y reactivar pasan por funciones de la base que revisan
 * `es_superadmin()` y dejan constancia en `platform_audit`. Aquí no se decide
 * nada: si alguien llamara estas acciones sin ser operador, contesta la base.
 */
export async function suspenderConsultorio(
  _estado: ResultadoPlataforma,
  datos: FormData,
): Promise<ResultadoPlataforma> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('plataforma_suspender', {
    p_id: String(datos.get('id') ?? ''),
    p_motivo: String(datos.get('motivo') ?? ''),
  })

  if (error) return { error: error.message.replace(/^.*?:\s*/, '') }

  revalidatePath('/plataforma')
  return { ok: 'Cuenta suspendida.' }
}

export async function reactivarConsultorio(datos: FormData): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('plataforma_reactivar', { p_id: String(datos.get('id') ?? '') })
  revalidatePath('/plataforma')
}
