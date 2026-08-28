'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoEstudio = { error?: string; ok?: string }

const BUCKET = 'expedientes'
const MAX_BYTES = 20 * 1024 * 1024
const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

/**
 * Un nombre de archivo llega como lo puso el celular de alguien: acentos,
 * espacios, emojis, y a veces `../`. La ruta se arma con uno saneado; el
 * original se guarda aparte, que es el que el médico reconoce.
 */
function rutaSegura(nombre: string) {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .slice(-60) || 'archivo'
  )
}

export async function subirEstudio(
  _estado: ResultadoEstudio,
  datos: FormData,
): Promise<ResultadoEstudio> {
  const { profesional, esDueño } = await exigirConsultorio()
  // Misma regla que el resto de lo clínico: el asistente no entra aquí.
  if (!esDueño) return { error: 'Los estudios del expediente solo los ve el médico.' }

  const pacienteId = String(datos.get('patient_id') ?? '')
  const citaId = String(datos.get('appointment_id') ?? '') || null
  const archivo = datos.get('archivo')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Elige un archivo primero.' }
  }
  if (!TIPOS[archivo.type]) {
    return { error: 'Se aceptan imágenes (JPG, PNG, WebP, HEIC) y PDF.' }
  }
  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return { error: `El archivo pesa ${mb} MB y el máximo son 20 MB.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = `${profesional.id}/${pacienteId}/${Date.now()}-${rutaSegura(archivo.name)}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

  if (errorSubida) return { error: errorSubida.message }

  const { error } = await supabase.from('consultation_files').insert({
    professional_id: profesional.id,
    patient_id: pacienteId,
    appointment_id: citaId,
    path: ruta,
    filename: archivo.name,
    mime: archivo.type,
    size_bytes: archivo.size,
    kind: String(datos.get('kind') ?? '').trim() || null,
    uploaded_by: user?.id ?? null,
  })

  if (error) {
    // Un archivo que nadie puede encontrar es basura: se va con su fila.
    await supabase.storage.from(BUCKET).remove([ruta])
    return { error: error.message }
  }

  revalidatePath(`/admin/pacientes/${pacienteId}`)
  if (citaId) revalidatePath(`/admin/consulta/${citaId}`)
  return { ok: 'Archivo agregado.' }
}

export async function borrarEstudio(datos: FormData): Promise<void> {
  const { esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const id = String(datos.get('id') ?? '')
  const supabase = await createClient()

  const { data: estudio } = await supabase
    .from('consultation_files')
    .select('path, patient_id, appointment_id')
    .eq('id', id)
    .maybeSingle<{ path: string; patient_id: string; appointment_id: string | null }>()

  if (!estudio) return

  // Se archiva, no se borra: un estudio es tan del expediente como una nota, y
  // la norma pide conservarlo. Deja de verse, pero sigue ahí y el archivo se
  // queda en su lugar.
  const { error } = await supabase
    .from('consultation_files')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return

  revalidatePath(`/admin/pacientes/${estudio.patient_id}`)
  if (estudio.appointment_id) revalidatePath(`/admin/consulta/${estudio.appointment_id}`)
}
