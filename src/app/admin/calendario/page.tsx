import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { ColumnaDia, PX_POR_MINUTO, ReglaHoras } from '@/components/calendario/columna-dia'
import { VistaAgenda } from '@/components/vista-agenda'
import {
  bandasDelDia,
  colocarEnDia,
  hoyEnZona,
  medianocheDe,
  minutosAhora,
  semanaDe,
  sumarDias,
  ventanaVisible,
  type Evento,
} from '@/lib/calendario'
import type { Appointment, Availability, Patient, TimeBlock } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Calendario' }

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function numeroDeDia(fecha: string) {
  return Number(fecha.split('-')[2])
}

function nombreDeDia(fecha: string) {
  return DIAS_CORTOS[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
}

function rotulo(fechas: string[]) {
  const mes = (f: string) =>
    new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${f}T12:00:00Z`),
    )
  const primero = mes(fechas[0])
  const ultimo = mes(fechas[6])
  return primero === ultimo ? primero : `${primero} – ${ultimo}`
}

type CitaCal = Pick<Appointment, 'id' | 'starts_at' | 'ends_at' | 'status' | 'notes'> & {
  patients: Pick<Patient, 'name'> | null
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  const hoy = hoyEnZona(zona)
  const ancla = typeof params.semana === 'string' ? params.semana : hoy
  const dias = semanaDe(ancla)
  const diaMovil =
    typeof params.dia === 'string' && dias.includes(params.dia)
      ? params.dia
      : dias.includes(hoy)
        ? hoy
        : dias[0]

  // La semana en instantes UTC, para pedirle a la base solo lo que se ve.
  const desde = medianocheDe(dias[0], zona).toISOString()
  const hasta = medianocheDe(sumarDias(dias[6], 1), zona).toISOString()

  const [{ data: citas }, { data: bloqueos }, { data: franjas }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, notes, patients(name)')
      .in('status', ['confirmed', 'requested'])
      .lt('starts_at', hasta)
      .gt('ends_at', desde)
      .returns<CitaCal[]>(),
    supabase
      .from('time_blocks')
      .select('id, starts_at, ends_at, reason')
      .lt('starts_at', hasta)
      .gt('ends_at', desde)
      .returns<Pick<TimeBlock, 'id' | 'starts_at' | 'ends_at' | 'reason'>[]>(),
    supabase
      .from('availability')
      .select('weekday, start_time, end_time')
      .returns<Pick<Availability, 'weekday' | 'start_time' | 'end_time'>[]>(),
  ])

  const eventos: Evento[] = [
    ...(citas ?? []).map((c) => ({
      id: c.id,
      inicio: c.starts_at,
      fin: c.ends_at,
      titulo: c.patients?.name ?? 'Paciente sin nombre',
      tipo: 'cita' as const,
      estado: c.status,
      detalle: c.notes,
    })),
    ...(bloqueos ?? []).map((b) => ({
      id: `bloqueo-${b.id}`,
      inicio: b.starts_at,
      fin: b.ends_at,
      titulo: b.reason ?? 'No disponible',
      tipo: 'bloqueo' as const,
      detalle: null,
    })),
  ]

  const porDia = dias.map((fecha) => ({
    fecha,
    bandas: bandasDelDia(franjas ?? [], fecha),
    eventos: colocarEnDia(eventos, fecha, zona),
  }))

  const ventana = ventanaVisible(franjas ?? [], porDia.flatMap((d) => d.eventos))
  const altoHora = `${60 * PX_POR_MINUTO}px`

  const ahoraEnZona = minutosAhora(zona)

  const semanaAnterior = sumarDias(dias[0], -7)
  const semanaSiguiente = sumarDias(dias[0], 7)
  const delMovil = porDia.find((d) => d.fecha === diaMovil)!

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Calendario</h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">{rotulo(dias)}</p>
        </div>
        <VistaAgenda actual="calendario" />
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/admin/calendario?semana=${semanaAnterior}`}
          aria-label="Semana anterior"
          className="boton boton-suave px-3 py-1.5"
        >
          ←
        </Link>
        <Link href="/admin/calendario" className="boton boton-suave px-3 py-1.5 text-xs">
          Hoy
        </Link>
        <Link
          href={`/admin/calendario?semana=${semanaSiguiente}`}
          aria-label="Semana siguiente"
          className="boton boton-suave px-3 py-1.5"
        >
          →
        </Link>
      </div>

      {/* ---------- Móvil: un día a la vez ---------- */}
      <div className="md:hidden">
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dias.map((fecha) => {
            const activo = fecha === diaMovil
            return (
              <Link
                key={fecha}
                href={`/admin/calendario?semana=${dias[0]}&dia=${fecha}`}
                aria-current={activo ? 'date' : undefined}
                className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-2 text-xs transition ${
                  activo
                    ? 'bg-brand-vivo text-white'
                    : fecha === hoy
                      ? 'bg-brand-suave text-brand'
                      : 'text-muted hover:bg-surface-2'
                }`}
              >
                <span>{nombreDeDia(fecha)}</span>
                <span className="text-sm font-semibold tabular-nums">{numeroDeDia(fecha)}</span>
              </Link>
            )
          })}
        </div>

        <div className="tarjeta overflow-hidden p-3">
          <div className="flex" style={{ ['--alto-hora' as string]: altoHora }}>
            <ReglaHoras ventana={ventana} />
            <div className="flex-1">
              <ColumnaDia
                bandas={delMovil.bandas}
                eventos={delMovil.eventos}
                ventana={ventana}
                ahoraMin={delMovil.fecha === hoy ? ahoraEnZona : undefined}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Escritorio: la semana completa ---------- */}
      <div className="hidden md:block">
        <div className="tarjeta overflow-hidden">
          <div className="flex border-b border-border">
            <div className="w-14 shrink-0" />
            {dias.map((fecha) => (
              <div
                key={fecha}
                className={`flex-1 border-l border-border py-2 text-center ${
                  fecha === hoy ? 'bg-brand-suave' : ''
                }`}
              >
                <p className="text-xs text-muted">{nombreDeDia(fecha)}</p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    fecha === hoy ? 'text-brand' : 'text-ink'
                  }`}
                >
                  {numeroDeDia(fecha)}
                </p>
              </div>
            ))}
          </div>

          <div
            className="flex overflow-y-auto"
            style={{ ['--alto-hora' as string]: altoHora, maxHeight: '70vh' }}
          >
            <ReglaHoras ventana={ventana} />
            {porDia.map((dia) => (
              <div key={dia.fecha} className="flex-1">
                <ColumnaDia
                  bandas={dia.bandas}
                  eventos={dia.eventos}
                  ventana={ventana}
                  ahoraMin={dia.fecha === hoy ? ahoraEnZona : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-brand-vivo" /> Confirmada
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-dashed border-brand bg-brand-suave" />{' '}
          Solicitud pendiente
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm border border-border"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--surface-2) 0 3px, var(--border) 3px 4px)',
            }}
          />{' '}
          Bloqueo
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-peligro" /> Ahora
        </li>
      </ul>
    </>
  )
}
