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

export async function cargarPaginaPublica(slug: string) {
  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('public_professionals')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<PerfilPublico>()

  if (!perfil) return null

  const [{ data: disponibilidad }, { data: bloqueos }, { data: ocupados }] = await Promise.all([
    supabase
      .from('public_availability')
      .select('weekday, start_time, end_time')
      .eq('professional_id', perfil.id)
      .returns<Franja[]>(),
    supabase
      .from('public_time_blocks')
      .select('starts_at, ends_at')
      .eq('professional_id', perfil.id)
      .returns<Intervalo[]>(),
    supabase
      .from('public_busy_slots')
      .select('starts_at, ends_at')
      .eq('professional_id', perfil.id)
      .returns<Intervalo[]>(),
  ])

  return { perfil, disponibilidad: disponibilidad ?? [], bloqueos: bloqueos ?? [], ocupados: ocupados ?? [] }
}

export function huecosDe(datos: NonNullable<Awaited<ReturnType<typeof cargarPaginaPublica>>>) {
  return calcularHuecos({
    disponibilidad: datos.disponibilidad,
    bloqueos: datos.bloqueos,
    ocupados: datos.ocupados,
    duracionMin: datos.perfil.slot_duration ?? 30,
    zona: datos.perfil.timezone,
    // Dos meses: suficiente para que el calendario tenga a dónde avanzar.
    dias: 60,
    // Nadie quiere una solicitud para dentro de veinte minutos.
    anticipacionMin: 120,
  })
}
