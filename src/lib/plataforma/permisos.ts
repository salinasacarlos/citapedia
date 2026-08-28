'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PlatformRole } from '@/lib/database.types'

export type ResultadoPermiso = { error?: string; ok?: string }

export async function darPermiso(
  _estado: ResultadoPermiso,
  datos: FormData,
): Promise<ResultadoPermiso> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('plataforma_dar_permiso', {
    p_email: String(datos.get('email') ?? ''),
    p_rol: String(datos.get('rol') ?? 'soporte') as PlatformRole,
  })

  if (error) return { error: error.message.replace(/^.*?:\s*/, '') }

  revalidatePath('/plataforma/operadores')
  return { ok: 'Permiso actualizado.' }
}

export async function quitarPermiso(datos: FormData): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('plataforma_quitar_permiso', {
    p_email: String(datos.get('email') ?? ''),
  })
  revalidatePath('/plataforma/operadores')
}
