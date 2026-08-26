'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ResultadoCita = { error?: string; ok?: string }

function traducir(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo completar.'
}

export async function confirmarAsistencia(
  _estado: ResultadoCita,
  datos: FormData,
): Promise<ResultadoCita> {
  const token = String(datos.get('token') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_asistencia', { p_token: token })
  if (error) return { error: traducir(error.message) }

  revalidatePath(`/cita/${token}`)
  return { ok: 'Confirmada' }
}

export async function cancelarComoPaciente(
  _estado: ResultadoCita,
  datos: FormData,
): Promise<ResultadoCita> {
  const token = String(datos.get('token') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_cita_paciente', { p_token: token })
  if (error) return { error: traducir(error.message) }

  revalidatePath(`/cita/${token}`)
  return { ok: 'Cancelada' }
}
