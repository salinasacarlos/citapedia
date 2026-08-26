import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { FormularioReagendar } from '@/components/formulario-reagendar'
import { calcularHuecos, type Franja, type Intervalo } from '@/lib/slots'
import { duracion, fechaLarga, hora } from '@/lib/fechas'
import type { Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reagendar' }

type Cita = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  patients: Pick<Patient, 'name' | 'phone'> | null
}

export default async function ReagendarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  // RLS decide: si la cita no es de este consultorio, no aparece.
  const { data: cita } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, patients(name, phone)')
    .eq('id', id)
    .maybeSingle<Cita>()

  if (!cita) notFound()

  if (cita.status !== 'confirmed') {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink">No se puede reagendar</h1>
        <p className="mt-2 text-muted">
          Solo las citas confirmadas se pueden mover. Esta ya cambió de estado.
        </p>
        <Link href="/admin" className="boton boton-suave mt-6">
          Volver a la agenda
        </Link>
      </>
    )
  }

  const [{ data: disponibilidad }, { data: bloqueos }, { data: ocupados }] = await Promise.all([
    supabase
      .from('availability')
      .select('weekday, start_time, end_time')
      .returns<Franja[]>(),
    supabase.from('time_blocks').select('starts_at, ends_at').returns<Intervalo[]>(),
    supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('status', 'confirmed')
      .neq('id', cita.id)
      .returns<Intervalo[]>(),
  ])

  // La propia cita no cuenta como ocupada: si contara, no se podría mover unos
  // minutos dentro de su mismo rato.
  const dias = calcularHuecos({
    disponibilidad: disponibilidad ?? [],
    bloqueos: bloqueos ?? [],
    ocupados: ocupados ?? [],
    duracionMin: Math.round(
      (new Date(cita.ends_at).getTime() - new Date(cita.starts_at).getTime()) / 60_000,
    ),
    zona,
    dias: 60,
  })

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Reagendar cita</h1>
        <p className="mt-1 text-sm text-muted">
          Elige el horario nuevo. La cita anterior queda cerrada y enlazada a esta.
        </p>
      </header>

      <div className="tarjeta mb-6 p-4 sm:p-5">
        <p className="font-semibold text-ink">
          {cita.patients?.name ?? 'Paciente sin nombre'}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
          <span className="first-letter:uppercase">{fechaLarga(cita.starts_at, zona)}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{hora(cita.starts_at, zona)}</span>
          <span aria-hidden>·</span>
          <span>{duracion(cita.starts_at, cita.ends_at)}</span>
        </p>
        {cita.patients?.phone && (
          <p className="mt-2 text-xs text-muted">
            Avísale tú al paciente: todavía no mandamos correos ni mensajes.{' '}
            {cita.patients.phone}
          </p>
        )}
      </div>

      {dias.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="font-semibold text-ink">No hay horarios libres</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Tu agenda no tiene huecos en las próximas semanas. Libera un espacio o
            amplía tu horario.
          </p>
        </div>
      ) : (
        <FormularioReagendar citaId={cita.id} zona={zona} dias={dias} />
      )}

      <Link href="/admin" className="boton boton-suave mt-6">
        Cancelar
      </Link>
    </>
  )
}
