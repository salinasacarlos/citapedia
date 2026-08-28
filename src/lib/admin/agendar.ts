'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoAgendar = { error?: string }

/**
 * Da de alta al paciente y lo devuelve para seguir agendando.
 *
 * Se separa de crear la cita a propósito: si el hueco se ocupó mientras la
 * recepcionista escribía, el paciente ya quedó capturado y no hay que
 * teclearlo otra vez.
 */
export async function crearPacienteRapido(
  _estado: ResultadoAgendar,
  datos: FormData,
): Promise<ResultadoAgendar> {
  const { profesional } = await exigirConsultorio()

  const name = String(datos.get('name') ?? '').trim()
  if (!name) return { error: 'Escribe el nombre del paciente.' }

  const paraOtro = datos.get('is_minor') === '1'
  const telefono = String(datos.get('phone') ?? '').trim() || null
  const correo = String(datos.get('email') ?? '').trim().toLowerCase() || null
  const tutor = String(datos.get('tutor_name') ?? '').trim() || null

  if (paraOtro && !tutor) {
    return { error: 'Escribe quién responde por el paciente.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .insert({
      professional_id: profesional.id,
      name,
      is_minor: paraOtro,
      // El teléfono es de quien contesta: del tutor si lo hay, del paciente si no.
      phone: paraOtro ? null : telefono,
      email: paraOtro ? null : correo,
      tutor_name: tutor,
      tutor_phone: paraOtro ? telefono : null,
      // Igual que el teléfono: el correo es de quien contesta.
      tutor_email: paraOtro ? correo : null,
      tutor_relationship: String(datos.get('tutor_relationship') ?? '').trim() || null,
      source: String(datos.get('source') ?? '').trim() || null,
      referred_by: String(datos.get('referred_by') ?? '').trim() || null,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) return { error: error.message }

  redirect(`/admin/agendar?paciente=${data.id}`)
}

export async function agendarCita(
  _estado: ResultadoAgendar,
  datos: FormData,
): Promise<ResultadoAgendar> {
  await exigirConsultorio()
  const supabase = await createClient()

  const { error } = await supabase.rpc('agendar_cita', {
    p_paciente: String(datos.get('paciente') ?? ''),
    p_inicio: String(datos.get('inicio') ?? ''),
    p_duracion: Number(datos.get('duracion')) || null,
    p_notas: String(datos.get('notas') ?? '').trim() || null,
  })

  if (error) {
    return { error: error.message.replace(/^.*?:\s*/, '').trim() || 'No se pudo agendar.' }
  }

  revalidatePath('/admin', 'layout')
  redirect('/admin?agendada=1')
}
