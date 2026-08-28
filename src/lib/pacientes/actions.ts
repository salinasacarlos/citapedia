'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import type { Patient } from '@/lib/database.types'

export type ResultadoPaciente = { error?: string; ok?: string }

function texto(datos: FormData, campo: string): string | null {
  const valor = String(datos.get(campo) ?? '').trim()
  return valor === '' ? null : valor
}

function numero(datos: FormData, campo: string): number | null {
  const valor = texto(datos, campo)
  if (valor === null) return null
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function traducir(mensaje: string): string {
  if (mensaje.includes('patients_nacimiento_razonable')) {
    return 'Esa fecha de nacimiento no es posible.'
  }
  if (mensaje.includes('temperatura_razonable')) return 'Esa temperatura no es posible.'
  if (mensaje.includes('pulso_razonable')) return 'Ese pulso no es posible.'
  if (mensaje.includes('saturacion_razonable')) return 'La saturación va de 50 a 100.'
  if (mensaje.includes('peso_razonable')) return 'Ese peso no es posible.'
  if (mensaje.includes('talla_razonable')) return 'Esa talla no es posible.'
  // Último recurso: la pantalla ya avisa al escribir, pero si algo llegara
  // igual, que no salga el error crudo de Postgres.
  if (mensaje.includes('numeric field overflow')) {
    return 'Alguno de los signos vitales es demasiado grande. Revisa las unidades.'
  }
  if (mensaje.includes('row-level security')) {
    return 'No tienes permiso para ese cambio. El expediente clínico es del médico.'
  }
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo guardar.'
}

/** Los campos que el asistente también puede tocar: contacto y operación. */
function datosDePaciente(datos: FormData) {
  return {
    name: texto(datos, 'name'),
    birth_date: texto(datos, 'birth_date'),
    sex: texto(datos, 'sex') as Patient['sex'],
    phone: texto(datos, 'phone'),
    email: texto(datos, 'email'),
    is_minor: datos.get('is_minor') === 'on',
    tutor_name: texto(datos, 'tutor_name'),
    tutor_phone: texto(datos, 'tutor_phone'),
    tutor_email: texto(datos, 'tutor_email'),
    tutor_relationship: texto(datos, 'tutor_relationship'),
    emergency_contact_name: texto(datos, 'emergency_contact_name'),
    emergency_contact_phone: texto(datos, 'emergency_contact_phone'),
    emergency_contact_relationship: texto(datos, 'emergency_contact_relationship'),
    insurance: texto(datos, 'insurance'),
    source: texto(datos, 'source'),
    referred_by: texto(datos, 'referred_by'),
    notes: texto(datos, 'notes'),
  }
}

export async function crearPaciente(
  _estado: ResultadoPaciente,
  datos: FormData,
): Promise<ResultadoPaciente> {
  const { profesional } = await exigirConsultorio()
  const { name, ...resto } = datosDePaciente(datos)

  if (!name) return { error: 'El nombre no puede quedar vacío.' }
  if (resto.is_minor && !resto.tutor_name) {
    return { error: 'Si el paciente depende de alguien, escribe quién es.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .insert({ ...resto, name, professional_id: profesional.id })
    .select('id')
    .single<{ id: string }>()

  if (error) return { error: traducir(error.message) }

  revalidatePath('/admin/pacientes')
  redirect(`/admin/pacientes/${data.id}`)
}

export async function guardarPaciente(
  _estado: ResultadoPaciente,
  datos: FormData,
): Promise<ResultadoPaciente> {
  await exigirConsultorio()
  const id = String(datos.get('id') ?? '')
  const { name, ...resto } = datosDePaciente(datos)

  if (!name) return { error: 'El nombre no puede quedar vacío.' }

  const supabase = await createClient()
  const { error } = await supabase.from('patients').update({ ...resto, name }).eq('id', id)
  if (error) return { error: traducir(error.message) }

  revalidatePath(`/admin/pacientes/${id}`)
  return { ok: 'Datos guardados.' }
}

export async function guardarExpediente(
  _estado: ResultadoPaciente,
  datos: FormData,
): Promise<ResultadoPaciente> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'El expediente clínico solo lo edita el médico.' }

  const patient_id = String(datos.get('patient_id') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.from('clinical_records').upsert({
    patient_id,
    professional_id: profesional.id,
    allergies: texto(datos, 'allergies'),
    conditions: texto(datos, 'conditions'),
    medications: texto(datos, 'medications'),
    blood_type: texto(datos, 'blood_type'),
    family_history: texto(datos, 'family_history'),
    surgical_history: texto(datos, 'surgical_history'),
    immunizations: texto(datos, 'immunizations'),
    habits: texto(datos, 'habits'),
    notes: texto(datos, 'notes'),
  })

  if (error) return { error: traducir(error.message) }

  revalidatePath(`/admin/pacientes/${patient_id}`)
  return { ok: 'Expediente guardado.' }
}

/** Nota de una consulta: signos vitales, hallazgo y tratamiento. */
export async function guardarConsulta(
  _estado: ResultadoPaciente,
  datos: FormData,
): Promise<ResultadoPaciente> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Las notas de consulta solo las escribe el médico.' }

  const appointment_id = String(datos.get('appointment_id') ?? '')
  const patient_id = String(datos.get('patient_id') ?? '')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('consultation_notes').upsert(
    {
      appointment_id,
      patient_id,
      professional_id: profesional.id,
      author_id: user?.id ?? null,
      note: texto(datos, 'note'),
      diagnosis: texto(datos, 'diagnosis'),
      treatment: texto(datos, 'treatment'),
      weight_kg: numero(datos, 'weight_kg'),
      height_cm: numero(datos, 'height_cm'),
      temperature_c: numero(datos, 'temperature_c'),
      heart_rate: numero(datos, 'heart_rate'),
      oxygen_saturation: numero(datos, 'oxygen_saturation'),
      blood_pressure: texto(datos, 'blood_pressure'),
    },
    { onConflict: 'appointment_id' },
  )

  if (error) return { error: traducir(error.message) }

  revalidatePath(`/admin/pacientes/${patient_id}`)
  return { ok: 'Nota guardada.' }
}

/**
 * El médico pasa al expediente lo que declaró el paciente.
 *
 * La función de la base solo llena lo que está vacío: si el médico ya escribió
 * algo, lo suyo manda. Y lo declarado no se borra, queda marcado como
 * revisado, para que después se pueda saber de dónde salió cada cosa.
 */
export async function aceptarDeclarados(datos: FormData) {
  const { esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const patient_id = String(datos.get('patient_id') ?? '')
  const supabase = await createClient()
  await supabase.rpc('aceptar_datos_declarados', { p_paciente: patient_id })

  revalidatePath(`/admin/pacientes/${patient_id}`)
}
