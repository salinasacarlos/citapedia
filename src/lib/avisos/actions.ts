'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoAviso = { error?: string; ok?: string }

/**
 * Programa un aviso para un paciente.
 *
 * La fecha se elige, al revés del recordatorio de cita: es lo que permite
 * "avísale en seis meses" sin tener que inventar una cita para colgarlo.
 */
export async function crearAviso(
  _estado: ResultadoAviso,
  datos: FormData,
): Promise<ResultadoAviso> {
  const { profesional } = await exigirConsultorio()

  const titulo = String(datos.get('titulo') ?? '').trim()
  const due_on = String(datos.get('due_on') ?? '').trim()

  if (!titulo) return { error: 'Escribe de qué se trata el aviso.' }
  if (!due_on) return { error: 'Elige cuándo hay que avisarle.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const patient_id = String(datos.get('patient_id') ?? '')
  const { error } = await supabase.from('patient_alerts').insert({
    professional_id: profesional.id,
    patient_id,
    due_on,
    titulo,
    mensaje: String(datos.get('mensaje') ?? '').trim() || null,
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message.replace(/^.*?:\s*/, '') }

  revalidatePath(`/admin/pacientes/${patient_id}`)
  revalidatePath('/admin')
  return { ok: 'Aviso programado.' }
}

/** Ya se le avisó: sale de la lista sin borrarse, para saber que se hizo. */
export async function marcarAvisoEnviado(datos: FormData): Promise<void> {
  await exigirConsultorio()
  const supabase = await createClient()

  await supabase
    .from('patient_alerts')
    .update({ status: 'enviado', sent_at: new Date().toISOString() })
    .eq('id', String(datos.get('id') ?? ''))

  revalidatePath('/admin')
  revalidatePath(`/admin/pacientes/${String(datos.get('patient_id') ?? '')}`)
}

/** Ya no aplica. Tampoco se borra: que quede dicho que se decidió no mandarlo. */
export async function cancelarAviso(datos: FormData): Promise<void> {
  await exigirConsultorio()
  const supabase = await createClient()

  await supabase
    .from('patient_alerts')
    .update({ status: 'cancelado' })
    .eq('id', String(datos.get('id') ?? ''))

  revalidatePath('/admin')
  revalidatePath(`/admin/pacientes/${String(datos.get('patient_id') ?? '')}`)
}
