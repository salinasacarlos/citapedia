'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

/**
 * El paciente mueve su propia cita.
 *
 * La nueva nace confirmada: el hueco ya estaba libre y a ese paciente el
 * consultorio ya lo había aceptado. Hacerlo esperar otra vez por mover su cita
 * dos horas sería peor que si hubiera cancelado.
 */
export async function reagendarComoPaciente(
  _estado: ResultadoCita,
  datos: FormData,
): Promise<ResultadoCita> {
  const token = String(datos.get('token') ?? '')
  const supabase = await createClient()

  const { data: nuevo, error } = await supabase.rpc('reagendar_cita_paciente', {
    p_token: token,
    p_inicio: String(datos.get('inicio') ?? ''),
  })

  if (error) return { error: traducir(error.message) }

  // Se le manda a su cita nueva: la liga vieja ya apunta a una reagendada.
  redirect(`/cita/${nuevo}`)
}
