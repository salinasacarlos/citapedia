import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { EstadoVacio } from '@/components/estado-vacio'
import { Filtros } from '@/components/filtros'
import { Paginacion } from '@/components/paginacion'
import { POR_PAGINA, aplicarFiltros, hayFiltros, leerFiltros } from '@/lib/filtros'
import { fechaCorta, hora } from '@/lib/fechas'
import type { AppointmentStatus, Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Historial' }

type Cerrada = {
  id: string
  starts_at: string
  status: AppointmentStatus
  patients: Pick<Patient, 'name' | 'phone'> | null
}

/** Cómo se ve cada desenlace. El color dice tanto como la palabra. */
const DESENLACE: Partial<Record<AppointmentStatus, { texto: string; clase: string }>> = {
  completed: { texto: 'Se atendió', clase: 'bg-exito-suave text-exito' },
  no_show: { texto: 'No asistió', clase: 'bg-alerta-suave text-alerta' },
  rejected: { texto: 'Rechazada', clase: 'bg-surface-2 text-muted' },
  expired: { texto: 'Venció', clase: 'bg-surface-2 text-muted' },
  cancelled_by_patient: { texto: 'Canceló el paciente', clase: 'bg-peligro-suave text-peligro' },
  cancelled_by_professional: { texto: 'Cancelaste tú', clase: 'bg-peligro-suave text-peligro' },
  rescheduled: { texto: 'Reagendada', clase: 'bg-acento-suave text-acento' },
}

const CERRADAS: AppointmentStatus[] = [
  'completed',
  'no_show',
  'rejected',
  'expired',
  'cancelled_by_patient',
  'cancelled_by_professional',
  'rescheduled',
]

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtros = leerFiltros(params)
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  // `!inner` solo cuando hay búsqueda: si no, excluiría citas sin paciente.
  const relacion = filtros.q ? 'patients!inner(name, phone)' : 'patients(name, phone)'
  const desde = (filtros.pagina - 1) * POR_PAGINA

  const consulta = aplicarFiltros(
    supabase
      .from('appointments')
      .select(`id, starts_at, status, ${relacion}`, { count: 'exact' }),
    filtros,
    zona,
    CERRADAS,
  )

  const { data, count } = await consulta
    .order('starts_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)
    .returns<Cerrada[]>()

  const citas = data ?? []
  const total = count ?? 0

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Historial</h1>
        <p className="mt-1 text-sm text-muted">
          Todas las citas cerradas, de la más reciente a la más vieja.
        </p>
      </header>

      <Filtros
        ruta="/admin/historial"
        estados={CERRADAS.map((estado) => ({
          valor: estado,
          etiqueta: DESENLACE[estado]?.texto ?? estado,
        }))}
      />

      <p className="mb-3 text-sm text-muted">
        {total === 0
          ? 'Ningún resultado.'
          : `${total} ${total === 1 ? 'cita' : 'citas'}${
              hayFiltros(filtros) ? ' con estos filtros' : ''
            }.`}
      </p>

      {citas.length === 0 ? (
        <EstadoVacio titulo={hayFiltros(filtros) ? 'Nada coincide' : 'Nada en el historial'}>
          {hayFiltros(filtros)
            ? 'Prueba con otro nombre o amplía el rango de fechas.'
            : 'Aquí van a caer las citas que se atiendan, se cancelen, se rechacen o venzan.'}
        </EstadoVacio>
      ) : (
        <ul className="space-y-2">
          {citas.map((cita) => {
            const desenlace = DESENLACE[cita.status]
            return (
              <li
                key={cita.id}
                className="tarjeta flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {cita.patients?.name ?? 'Paciente sin nombre'}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted">
                    <span className="first-letter:uppercase">
                      {fechaCorta(cita.starts_at, zona)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{hora(cita.starts_at, zona)}</span>
                    {cita.patients?.phone && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="whitespace-nowrap">{cita.patients.phone}</span>
                      </>
                    )}
                  </p>
                </div>
                {desenlace && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${desenlace.clase}`}
                  >
                    {desenlace.texto}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Paginacion
        ruta="/admin/historial"
        params={params}
        pagina={filtros.pagina}
        total={total}
        porPagina={POR_PAGINA}
      />
    </>
  )
}
