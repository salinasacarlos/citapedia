import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirSuperadmin } from '@/lib/plataforma/acceso'
import { reactivarConsultorio } from '@/lib/plataforma/actions'
import { SuspenderConsultorio } from '@/components/suspender-consultorio'
import { fechaCorta, hora, relativo } from '@/lib/fechas'
import type { AppointmentStatus, MemberRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

type Ficha = {
  id: string
  name: string
  slug: string
  specialty: string | null
  email: string | null
  timezone: string
  slot_duration: number
  created_at: string
  suspended_at: string | null
  suspended_reason: string | null
  franjas: number
  bloqueos: number
  pacientes: number
  solicitadas: number
  confirmadas: number
  atendidas: number
  inasistencias: number
  canceladas: number
  recordatorios_horas: number[] | null
  ultima_actividad: string | null
}

type Miembro = { email: string; rol: MemberRole; desde: string; ultimo_ingreso: string | null }

type Cita = {
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  created_at: string
  tiene_paciente: boolean
  confirmada_por_paciente: boolean
  recordatorio_enviado: boolean
}

type Anotacion = {
  created_at: string
  action: string
  detail: string | null
  actor: string | null
}

const ESTADO: Record<AppointmentStatus, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  expired: 'Venció',
  completed: 'Se atendió',
  no_show: 'No asistió',
  cancelled_by_patient: 'Canceló el paciente',
  cancelled_by_professional: 'Canceló el consultorio',
  rescheduled: 'Reagendada',
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="text-lg font-bold tabular-nums text-ink">{valor}</dd>
    </div>
  )
}

export default async function FichaConsultorio({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await exigirSuperadmin()

  const [{ data: fichas }, { data: equipo }, { data: citas }, { data: bitacora }] =
    await Promise.all([
      supabase.rpc('plataforma_consultorio', { p_id: id }).returns<Ficha[]>(),
      supabase.rpc('plataforma_equipo', { p_id: id }).returns<Miembro[]>(),
      supabase.rpc('plataforma_citas', { p_id: id, p_limite: 20 }).returns<Cita[]>(),
      supabase
        .rpc('plataforma_bitacora', { p_target: id, p_limite: 20 })
        .returns<Anotacion[]>(),
    ])

  const c = fichas?.[0]
  if (!c) notFound()

  const zona = c.timezone
  // Sin horario publicado no hay huecos que ofrecer: es la causa número uno de
  // "mi página no deja agendar", y por eso va arriba y en rojo.
  const sinHorario = c.franjas === 0

  return (
    <>
      <Link
        href="/plataforma"
        className="text-xs font-semibold text-acento hover:underline"
      >
        ← Todos los consultorios
      </Link>

      <header className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-ink">
            {c.name}
            {c.suspended_at && (
              <span className="rounded-full bg-peligro-suave px-2.5 py-1 text-xs font-medium text-peligro">
                Suspendido
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
            <Link href={`/${c.slug}`} className="text-acento hover:underline">
              /{c.slug}
            </Link>
            {c.specialty && (
              <>
                <span aria-hidden>·</span>
                <span>{c.specialty}</span>
              </>
            )}
            {c.email && (
              <>
                <span aria-hidden>·</span>
                <span className="break-all">{c.email}</span>
              </>
            )}
          </p>
        </div>
        <div className="sm:shrink-0">
          {c.suspended_at ? (
            <form action={reactivarConsultorio}>
              <input type="hidden" name="id" value={c.id} />
              <button className="boton boton-primario px-3 py-1.5 text-xs">
                Reactivar
              </button>
            </form>
          ) : (
            <SuspenderConsultorio id={c.id} nombre={c.name} />
          )}
        </div>
      </header>

      {c.suspended_reason && (
        <p className="mt-3 text-sm text-peligro">Motivo: {c.suspended_reason}</p>
      )}

      {sinHorario && (
        <div className="mt-5 rounded-marca border border-alerta/30 bg-alerta-suave px-4 py-3">
          <p className="text-sm font-semibold text-alerta">No tiene horario publicado</p>
          <p className="mt-1 text-sm text-muted">
            Sin franjas de atención su página pública no puede ofrecer ningún hueco.
            Es la causa más común de &ldquo;mi liga no deja agendar&rdquo;.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="tarjeta p-4 sm:p-5">
            <h2 className="mb-3 font-semibold text-ink">Cómo va su agenda</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Cifra etiqueta="Pacientes" valor={c.pacientes} />
              <Cifra etiqueta="Por revisar" valor={c.solicitadas} />
              <Cifra etiqueta="Confirmadas" valor={c.confirmadas} />
              <Cifra etiqueta="Atendidas" valor={c.atendidas} />
              <Cifra etiqueta="Inasistencias" valor={c.inasistencias} />
              <Cifra etiqueta="Canceladas" valor={c.canceladas} />
            </dl>
          </section>

          <section className="tarjeta p-4 sm:p-5">
            <h2 className="font-semibold text-ink">Últimas citas</h2>
            <p className="mb-3 text-xs text-muted">
              Sin nombres: para diagnosticar basta con cuándo y en qué quedó.
            </p>
            {citas && citas.length > 0 ? (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 font-medium">Cuándo</th>
                      <th className="py-1 font-medium">Estado</th>
                      <th className="py-1 font-medium">Pedida</th>
                      <th className="py-1 font-medium">Paciente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citas.map((cita) => (
                      <tr key={cita.created_at + cita.starts_at} className="border-t border-border">
                        <td className="py-1.5 whitespace-nowrap tabular-nums">
                          <span className="first-letter:uppercase">
                            {fechaCorta(cita.starts_at, zona)}
                          </span>{' '}
                          {hora(cita.starts_at, zona)}
                        </td>
                        <td className="py-1.5">
                          {ESTADO[cita.status]}
                          {cita.confirmada_por_paciente && (
                            <span className="ml-1 text-xs text-exito">· confirmó</span>
                          )}
                        </td>
                        <td className="py-1.5 whitespace-nowrap text-muted">
                          {relativo(cita.created_at)}
                        </td>
                        <td className="py-1.5 text-muted">
                          {cita.tiene_paciente ? 'sí' : 'sin ficha'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">Todavía no tiene citas.</p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold text-ink">Configuración</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Alta</dt>
                <dd className="tabular-nums">{fechaCorta(c.created_at, 'UTC')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Zona</dt>
                <dd className="text-right">{c.timezone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Duración</dt>
                <dd className="tabular-nums">{c.slot_duration} min</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Franjas</dt>
                <dd className={`tabular-nums ${sinHorario ? 'font-semibold text-alerta' : ''}`}>
                  {c.franjas}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Bloqueos</dt>
                <dd className="tabular-nums">{c.bloqueos}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Recordatorio</dt>
                <dd className="tabular-nums">
                  {c.recordatorios_horas?.length
                    ? `${c.recordatorios_horas.join(', ')} h antes`
                    : 'sin definir'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Última cita creada</dt>
                <dd>{c.ultima_actividad ? relativo(c.ultima_actividad) : 'nunca'}</dd>
              </div>
            </dl>
          </section>

          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold text-ink">Quién tiene acceso</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {(equipo ?? []).map((m) => (
                <li key={m.email}>
                  <p className="break-all">{m.email}</p>
                  <p className="text-xs text-muted">
                    {m.rol === 'owner' ? 'Dueño' : 'Asistente'} ·{' '}
                    {m.ultimo_ingreso
                      ? `entró ${relativo(m.ultimo_ingreso)}`
                      : 'nunca ha entrado'}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {bitacora && bitacora.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="text-sm font-semibold text-ink">Lo que hizo la plataforma</h2>
              <ul className="mt-2 space-y-2 text-xs">
                {bitacora.map((a) => (
                  <li key={a.created_at}>
                    <p className="font-medium text-ink">
                      {a.action} · <span className="text-muted">{relativo(a.created_at)}</span>
                    </p>
                    {a.detail && <p className="text-muted">{a.detail}</p>}
                    {a.actor && <p className="break-all text-muted">por {a.actor}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
