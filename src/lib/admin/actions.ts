'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import type { AppointmentStatus } from '@/lib/database.types'
import { horaLocalAInstante } from '@/lib/slots'

export type Resultado = { error?: string; ok?: string }

/** Traduce los errores de Postgres a algo que un médico pueda accionar. */
function traducirError(mensaje: string): string {
  if (mensaje.includes('appointments_no_overlap_when_confirmed')) {
    return 'Ya tienes otra cita confirmada que se encima con ese horario.'
  }
  if (mensaje.includes('professionals_slug_key')) {
    return 'Esa liga ya la está usando otro consultorio. Prueba con otra.'
  }
  if (mensaje.includes('professionals_slug_format')) {
    return 'La liga solo admite minúsculas, números y guiones.'
  }
  if (mensaje.includes('professionals_slug_no_reservado')) {
    return 'Esa palabra la usa CitaPedia para sus propias páginas. Elige otra liga.'
  }
  if (mensaje.includes('professionals_slug_largo')) {
    return 'La liga debe tener entre 3 y 60 caracteres.'
  }
  if (mensaje.includes('Transición de cita inválida')) {
    return 'Esa cita ya cambió de estado. Recarga para ver cómo quedó.'
  }
  if (mensaje.includes('availability_time_order')) {
    return 'La hora de fin tiene que ser posterior a la de inicio.'
  }
  if (mensaje.includes('Zona horaria desconocida')) {
    return 'Esa zona horaria no existe.'
  }
  if (mensaje.includes('row-level security')) {
    return 'No tienes permiso para hacer ese cambio.'
  }
  if (mensaje.includes('exceeded the maximum allowed size')) {
    return 'La foto pesa más de 5 MB.'
  }
  if (mensaje.includes('mime type') || mensaje.includes('not supported')) {
    return 'Ese tipo de archivo no se admite. Usa JPG, PNG o WebP.'
  }
  return mensaje
}

// ------------------------------------------------------------------ perfil

export async function guardarPerfil(
  _estado: Resultado,
  datos: FormData,
): Promise<Resultado> {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()

  const texto = (campo: string) => {
    const valor = String(datos.get(campo) ?? '').trim()
    return valor === '' ? null : valor
  }

  const name = texto('name')
  if (!name) return { error: 'El nombre no puede quedar vacío.' }

  const slug = texto('slug')
  if (!slug) return { error: 'Necesitas una liga para tu página pública.' }

  const duracion = Number(datos.get('slot_duration'))
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 240) {
    return { error: 'La duración de la cita debe estar entre 5 y 240 minutos.' }
  }

  const { error } = await supabase
    .from('professionals')
    .update({
      name,
      slug,
      specialty: texto('specialty'),
      phone: texto('phone'),
      clinic_address: texto('clinic_address'),
      bio: texto('bio'),
      consultation_info: texto('consultation_info'),
      timezone: String(datos.get('timezone') ?? profesional.timezone),
      slot_duration: duracion,
    })
    .eq('id', profesional.id)

  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admin', 'layout')
  return { ok: 'Perfil actualizado.' }
}

// ----------------------------------------------------------------- horario

export async function agregarFranja(
  _estado: Resultado,
  datos: FormData,
): Promise<Resultado> {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()

  const weekday = Number(datos.get('weekday'))
  const start_time = String(datos.get('start_time') ?? '')
  const end_time = String(datos.get('end_time') ?? '')

  if (!start_time || !end_time) return { error: 'Pon la hora de inicio y la de fin.' }
  if (end_time <= start_time) {
    return { error: 'La hora de fin tiene que ser posterior a la de inicio.' }
  }

  // Dos franjas encimadas el mismo día duplicarían los huecos ofrecidos.
  const { data: existentes } = await supabase
    .from('availability')
    .select('start_time, end_time')
    .eq('professional_id', profesional.id)
    .eq('weekday', weekday)

  const encimada = (existentes ?? []).some(
    (f) => start_time < f.end_time && end_time > f.start_time,
  )
  if (encimada) {
    return { error: 'Ese rango se encima con otro que ya tienes ese día.' }
  }

  const { error } = await supabase.from('availability').insert({
    professional_id: profesional.id,
    weekday,
    start_time,
    end_time,
  })

  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admin/horario')
  return { ok: 'Franja agregada.' }
}

export async function quitarFranja(datos: FormData) {
  await exigirConsultorio()
  const supabase = await createClient()
  await supabase.from('availability').delete().eq('id', String(datos.get('id')))
  revalidatePath('/admin/horario')
}

// --------------------------------------------------------------- solicitudes

async function cambiarEstado(id: string, status: AppointmentStatus): Promise<Resultado> {
  await exigirConsultorio()
  const supabase = await createClient()

  const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admin', 'layout')
  return { ok: 'Listo.' }
}

export async function aceptarCita(_estado: Resultado, datos: FormData) {
  return cambiarEstado(String(datos.get('id')), 'confirmed')
}

export async function rechazarCita(_estado: Resultado, datos: FormData) {
  return cambiarEstado(String(datos.get('id')), 'rejected')
}

export async function marcarCompletada(_estado: Resultado, datos: FormData) {
  return cambiarEstado(String(datos.get('id')), 'completed')
}

export async function marcarNoAsistio(_estado: Resultado, datos: FormData) {
  return cambiarEstado(String(datos.get('id')), 'no_show')
}

export async function cancelarCita(_estado: Resultado, datos: FormData) {
  return cambiarEstado(String(datos.get('id')), 'cancelled_by_professional')
}

// ------------------------------------------------------------------- foto

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FOTO = 5 * 1024 * 1024
const BUCKET = 'fotos-perfil'

/** La ruta de una foto nuestra dentro del bucket, o null si es de fuera. */
function rutaEnBucket(url: string | null): string | null {
  if (!url) return null
  const marca = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length))
}

export async function subirFoto(_estado: Resultado, datos: FormData): Promise<Resultado> {
  const { profesional } = await exigirConsultorio()
  const archivo = datos.get('foto')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Elige una imagen primero.' }
  }
  if (!TIPOS_FOTO.includes(archivo.type)) {
    return { error: 'La foto debe ser JPG, PNG o WebP.' }
  }
  if (archivo.size > MAX_FOTO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return { error: `La foto pesa ${mb} MB y el máximo son 5 MB.` }
  }

  const supabase = await createClient()
  const extension = archivo.type.split('/')[1].replace('jpeg', 'jpg')
  const ruta = `${profesional.id}/perfil-${Date.now()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

  if (errorSubida) return { error: traducirError(errorSubida.message) }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(ruta)

  const { error } = await supabase
    .from('professionals')
    .update({ photo_url: publicUrl })
    .eq('id', profesional.id)

  if (error) {
    // No dejamos el archivo huérfano si el perfil no se pudo actualizar.
    await supabase.storage.from(BUCKET).remove([ruta])
    return { error: traducirError(error.message) }
  }

  // El archivo anterior ya no le sirve a nadie.
  const anterior = rutaEnBucket(profesional.photo_url)
  if (anterior && anterior !== ruta) {
    await supabase.storage.from(BUCKET).remove([anterior])
  }

  revalidatePath('/admin', 'layout')
  revalidatePath(`/${profesional.slug}`)
  return { ok: 'Foto actualizada.' }
}

export async function quitarFoto(): Promise<void> {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()

  await supabase.from('professionals').update({ photo_url: null }).eq('id', profesional.id)

  const ruta = rutaEnBucket(profesional.photo_url)
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta])

  revalidatePath('/admin', 'layout')
  revalidatePath(`/${profesional.slug}`)
}

// --------------------------------------------------------------- bloqueos

/** 'YYYY-MM-DD' + 'HH:MM' en la zona del consultorio → instante UTC. */
function instante(fecha: string, hora: string, zona: string): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  return horaLocalAInstante(a, m, d, h, min, zona)
}

export async function agregarBloqueo(
  _estado: Resultado,
  datos: FormData,
): Promise<Resultado> {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  const desde = String(datos.get('fecha_inicio') ?? '')
  const hasta = String(datos.get('fecha_fin') ?? '') || desde
  const todoElDia = datos.get('todo_el_dia') === 'on'
  const motivo = String(datos.get('reason') ?? '').trim()

  if (!desde) return { error: 'Elige la fecha.' }
  if (hasta < desde) return { error: 'La fecha de fin no puede ser anterior a la de inicio.' }

  let inicio: Date
  let fin: Date

  if (todoElDia) {
    inicio = instante(desde, '00:00', zona)
    // El día completo termina cuando empieza el siguiente.
    const [a, m, d] = hasta.split('-').map(Number)
    const siguiente = new Date(Date.UTC(a, m - 1, d + 1))
    fin = instante(
      `${siguiente.getUTCFullYear()}-${String(siguiente.getUTCMonth() + 1).padStart(2, '0')}-${String(
        siguiente.getUTCDate(),
      ).padStart(2, '0')}`,
      '00:00',
      zona,
    )
  } else {
    const horaInicio = String(datos.get('hora_inicio') ?? '')
    const horaFin = String(datos.get('hora_fin') ?? '')
    if (!horaInicio || !horaFin) return { error: 'Pon la hora de inicio y la de fin.' }
    inicio = instante(desde, horaInicio, zona)
    fin = instante(hasta, horaFin, zona)
  }

  if (fin <= inicio) {
    return { error: 'El bloqueo tiene que terminar después de empezar.' }
  }

  // Tapar un rato donde ya prometiste atender es un problema real: avisamos
  // en vez de dejar citas confirmadas colgando dentro de un bloqueo.
  const { data: chocan } = await supabase
    .from('appointments')
    .select('starts_at')
    .eq('status', 'confirmed')
    .lt('starts_at', fin.toISOString())
    .gt('ends_at', inicio.toISOString())

  if (chocan && chocan.length > 0) {
    const cuantas = chocan.length
    return {
      error: `Tienes ${cuantas} cita${cuantas === 1 ? '' : 's'} confirmada${
        cuantas === 1 ? '' : 's'
      } dentro de ese rango. Cancélala${cuantas === 1 ? '' : 's'} o reagéndala${
        cuantas === 1 ? '' : 's'
      } antes de bloquear.`,
    }
  }

  const { error } = await supabase.from('time_blocks').insert({
    professional_id: profesional.id,
    starts_at: inicio.toISOString(),
    ends_at: fin.toISOString(),
    reason: motivo || null,
  })

  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admin/horario')
  revalidatePath(`/${profesional.slug}`)
  return { ok: 'Bloqueo agregado.' }
}

export async function quitarBloqueo(datos: FormData) {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  await supabase.from('time_blocks').delete().eq('id', String(datos.get('id')))
  revalidatePath('/admin/horario')
  revalidatePath(`/${profesional.slug}`)
}

// -------------------------------------------------------- higiene de agenda

/**
 * Solicitudes cuyo horario ya pasó sin que nadie las atendiera.
 *
 * Se marcan a mano desde la bandeja: mutar la base al renderizar una página
 * sería un efecto secundario invisible. El cron del módulo de recordatorios
 * hará esto mismo de forma automática.
 */
export async function marcarVencidas(): Promise<void> {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()

  await supabase
    .from('appointments')
    .update({ status: 'expired' })
    .eq('professional_id', profesional.id)
    .eq('status', 'requested')
    .lt('starts_at', new Date().toISOString())

  revalidatePath('/admin', 'layout')
}
