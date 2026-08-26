import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { BuscarPaciente, type PacienteBreve } from '@/components/buscar-paciente'
import { ElegirHuecoCita } from '@/components/elegir-hueco-cita'
import { calcularHuecos, type Franja, type Intervalo } from '@/lib/slots'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nueva cita' }

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const pacienteId = typeof params.paciente === 'string' ? params.paciente : ''

  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  const duracion =
    Number(typeof params.duracion === 'string' ? params.duracion : '') ||
    profesional.slot_duration ||
    30

  // ---------------------------------------------- paso 1: elegir paciente
  if (!pacienteId) {
    let consulta = supabase
      .from('patients')
      .select('id, name, phone, tutor_name, tutor_phone, is_minor')
      .order('name')
      .limit(20)

    if (q) {
      const t = q.replace(/[,()*]/g, '')
      consulta = consulta.or(
        `name.ilike.*${t}*,phone.ilike.*${t}*,tutor_name.ilike.*${t}*,tutor_phone.ilike.*${t}*`,
      )
    }

    const { data } = await consulta.returns<PacienteBreve[]>()

    return (
      <>
        <Link href="/admin" className="text-sm text-acento hover:underline">
          ← Agenda
        </Link>
        <header className="mt-3 mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Nueva cita</h1>
          <p className="mt-1 text-sm text-muted">
            Para agendar mientras tienes al paciente en el teléfono.
          </p>
        </header>
        <div className="tarjeta p-4 sm:p-6">
          <BuscarPaciente resultados={data ?? []} hayBusqueda={Boolean(q)} />
        </div>
      </>
    )
  }

  // ------------------------------------------------- paso 2: elegir hueco
  const { data: paciente } = await supabase
    .from('patients')
    .select('id, name')
    .eq('id', pacienteId)
    .maybeSingle<{ id: string; name: string }>()

  if (!paciente) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          No encontramos ese paciente
        </h1>
        <Link href="/admin/agendar" className="boton boton-suave mt-6">
          Buscar otro
        </Link>
      </>
    )
  }

  const [{ data: disponibilidad }, { data: bloqueos }, { data: ocupados }] = await Promise.all([
    supabase.from('availability').select('weekday, start_time, end_time').returns<Franja[]>(),
    supabase.from('time_blocks').select('starts_at, ends_at').returns<Intervalo[]>(),
    supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('status', 'confirmed')
      .returns<Intervalo[]>(),
  ])

  const dias = calcularHuecos({
    disponibilidad: disponibilidad ?? [],
    bloqueos: bloqueos ?? [],
    ocupados: ocupados ?? [],
    duracionMin: duracion,
    zona,
    dias: 60,
  })

  return (
    <>
      <Link href="/admin" className="text-sm text-acento hover:underline">
        ← Agenda
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Nueva cita</h1>
        <p className="mt-1 text-sm text-muted">
          Elige cuánto dura y a qué hora. Queda confirmada de una vez.
        </p>
      </header>

      <ElegirHuecoCita
        pacienteId={paciente.id}
        pacienteNombre={paciente.name}
        zona={zona}
        dias={dias}
        duracion={duracion}
      />
    </>
  )
}
