'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { BASES } from '@/lib/avisos/bases'

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

/**
 * Guarda una plantilla del consultorio.
 *
 * La diferencia con un aviso suelto: la plantilla no lleva una fecha, lleva la
 * regla para calcularla. "A los 6 meses de nacido" sirve para todos los
 * pacientes; "el 15 de marzo" sirve para uno.
 */
export async function crearPlantillaDeAviso(
  _estado: ResultadoAviso,
  datos: FormData,
): Promise<ResultadoAviso> {
  const { profesional } = await exigirConsultorio()

  const titulo = String(datos.get('titulo') ?? '').trim()
  const base = String(datos.get('base') ?? 'nacimiento')
  const meses = Number(datos.get('offset_meses') ?? 0)

  if (!titulo) return { error: 'Escribe de qué se trata el aviso.' }
  if (!BASES.some((b) => b.valor === base)) return { error: 'Elige desde cuándo se cuenta.' }
  if (!Number.isInteger(meses) || meses < 0 || meses > 240) {
    return { error: 'Los meses van de 0 a 240.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('alert_templates').insert({
    professional_id: profesional.id,
    titulo,
    mensaje: String(datos.get('mensaje') ?? '').trim() || null,
    base,
    offset_meses: meses,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/horario')
  return { ok: 'Plantilla guardada.' }
}

export async function borrarPlantillaDeAviso(datos: FormData): Promise<void> {
  await exigirConsultorio()
  const supabase = await createClient()
  await supabase.from('alert_templates').delete().eq('id', String(datos.get('id') ?? ''))
  revalidatePath('/admin/horario')
}

/**
 * Aplica una plantilla a un paciente.
 *
 * La fecha la calcula la base, no el navegador: es la misma cuenta que la
 * pantalla enseñó antes de aplicar, y tenerla en un solo lugar evita que
 * discrepen. Ahí también se rechaza una fecha ya pasada — el cron manda todo
 * lo que vence hoy o antes, así que saldría mañana por la mañana.
 */
export async function aplicarPlantilla(
  _estado: ResultadoAviso,
  datos: FormData,
): Promise<ResultadoAviso> {
  await exigirConsultorio()
  const supabase = await createClient()

  const { error } = await supabase.rpc('aplicar_plantilla', {
    p_plantilla: String(datos.get('plantilla') ?? ''),
    p_paciente: String(datos.get('patient_id') ?? ''),
  })

  if (error) return { error: error.message.replace(/^.*?:\s*/, '').trim() }

  revalidatePath(`/admin/pacientes/${String(datos.get('patient_id') ?? '')}`)
  return { ok: 'Aviso programado.' }
}
