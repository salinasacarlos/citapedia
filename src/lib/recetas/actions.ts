'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoReceta = { error?: string; ok?: string }

/**
 * Agrega un medicamento a la nota de una consulta.
 *
 * Solo el nombre es obligatorio. Dosis, frecuencia y duración se piden porque
 * son lo que después hace buscable una receta, pero exigirlas con el paciente
 * enfrente es cómo el campo deja de llenarse — y medio dato sirve más que
 * ninguno.
 */
export async function recetarMedicamento(
  _estado: ResultadoReceta,
  datos: FormData,
): Promise<ResultadoReceta> {
  const { profesional, esDueño } = await exigirConsultorio()
  // Una receta es tan clínica como una alergia. RLS lo impide igual; decirlo
  // aquí evita que el asistente vea un error de base que no explica nada.
  if (!esDueño) return { error: 'Solo el médico puede recetar.' }

  const medicamento = String(datos.get('medicamento') ?? '').trim()
  if (!medicamento) return { error: 'Escribe el medicamento.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('consultation_medications').insert({
    consultation_note_id: String(datos.get('nota') ?? ''),
    professional_id: profesional.id,
    medicamento,
    dosis: String(datos.get('dosis') ?? '').trim() || null,
    frecuencia: String(datos.get('frecuencia') ?? '').trim() || null,
    duracion: String(datos.get('duracion') ?? '').trim() || null,
    indicaciones: String(datos.get('indicaciones') ?? '').trim() || null,
    prescribed_by: user?.id ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/admin/consulta/${String(datos.get('cita') ?? '')}`)
  revalidatePath(`/admin/pacientes/${String(datos.get('paciente') ?? '')}`)
  return { ok: 'Medicamento agregado.' }
}

/**
 * Retira un medicamento. No lo borra.
 *
 * Suspender algo que ya se recetó es un hecho clínico: hay que poder ver que
 * se dio y que después se quitó. La base tampoco deja reescribir la fila —
 * corregir una receta es retirarla y escribir la correcta.
 */
export async function retirarMedicamento(datos: FormData): Promise<void> {
  const { esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const supabase = await createClient()
  await supabase
    .from('consultation_medications')
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: String(datos.get('motivo') ?? '').trim() || null,
    })
    .eq('id', String(datos.get('id') ?? ''))

  revalidatePath(`/admin/consulta/${String(datos.get('cita') ?? '')}`)
  revalidatePath(`/admin/pacientes/${String(datos.get('paciente') ?? '')}`)
}
