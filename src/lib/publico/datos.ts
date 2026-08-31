import { createClient } from '@/lib/supabase/server'
import { calcularHuecos, type Franja, type Intervalo } from '@/lib/slots'

/** Solo lo que el público puede ver: sale de las vistas, no de las tablas. */
export type PerfilPublico = {
  id: string
  name: string
  slug: string
  specialty: string | null
  bio: string | null
  photo_url: string | null
  theme: string | null
  consultation_info: string | null
  clinic_address: string | null
  phone: string | null
  slot_duration: number | null
  timezone: string
}

/**
 * Una consulta que falla no puede pasar por una lista vacía: sin horario la
 * página dice "no hay huecos", que es una mentira con cara de dato.
 */
function exigir<T>(que: string) {
  return ({ data, error }: { data: T[] | null; error: { message: string } | null }) => {
    if (error) throw new Error(`No se pudo leer ${que}: ${error.message}`)
    return data ?? []
  }
}

export async function cargarPaginaPublica(slug: string) {
  const supabase = await createClient()

  const { data: perfil, error } = await supabase
    .from('public_professionals')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<PerfilPublico>()

  // Si la consulta falla hay que reventar, no devolver null: null significa
  // "ese consultorio no existe", y con la llave rota la liga de todos los
  // médicos daría un 404 limpio sin nada en los logs.
  if (error) throw new Error(`No se pudo leer el consultorio ${slug}: ${error.message}`)
  if (!perfil) return null

  const [disponibilidad, bloqueos, ocupados] = await Promise.all([
    supabase
      .from('public_availability')
      .select('weekday, start_time, end_time')
      .eq('professional_id', perfil.id)
      .returns<Franja[]>()
      .then(exigir<Franja>('el horario')),
    supabase
      .from('public_time_blocks')
      .select('starts_at, ends_at')
      .eq('professional_id', perfil.id)
      .returns<Intervalo[]>()
      .then(exigir<Intervalo>('los bloqueos')),
    supabase
      .from('public_busy_slots')
      .select('starts_at, ends_at')
      .eq('professional_id', perfil.id)
      .returns<Intervalo[]>()
      .then(exigir<Intervalo>('las citas ocupadas')),
  ])

  return { perfil, disponibilidad, bloqueos, ocupados }
}

export function huecosDe(
  datos: NonNullable<Awaited<ReturnType<typeof cargarPaginaPublica>>>,
  /** Al mover una cita conserva su duración, que puede no ser la del slot. */
  duracionMin?: number,
) {
  return calcularHuecos({
    disponibilidad: datos.disponibilidad,
    bloqueos: datos.bloqueos,
    ocupados: datos.ocupados,
    duracionMin: duracionMin ?? datos.perfil.slot_duration ?? 30,
    zona: datos.perfil.timezone,
    // Dos meses: suficiente para que el calendario tenga a dónde avanzar.
    dias: 60,
    // Nadie quiere una solicitud para dentro de veinte minutos.
    anticipacionMin: 120,
  })
}
