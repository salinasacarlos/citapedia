'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoReagendar = { error?: string }

export async function reagendarCita(
  _estado: ResultadoReagendar,
  datos: FormData,
): Promise<ResultadoReagendar> {
  await exigirConsultorio()
  const supabase = await createClient()

  const { error } = await supabase.rpc('reagendar_cita', {
    p_cita: String(datos.get('cita') ?? ''),
    p_inicio: String(datos.get('inicio') ?? ''),
  })

  if (error) {
    return { error: error.message.replace(/^.*?:\s*/, '').trim() || 'No se pudo reagendar.' }
  }

  revalidatePath('/admin', 'layout')
  redirect('/admin?reagendada=1')
}
