import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { cancelarInvitacion, quitarAsistente } from '@/lib/equipo/actions'
import { QuitarAcceso } from '@/components/quitar-acceso'
import { RegenerarLiga } from '@/components/regenerar-liga'
import { InvitarAsistente } from '@/components/invitar-asistente'
import { LigaInvitacion } from '@/components/liga-invitacion'
import { fechaCorta } from '@/lib/fechas'
import type { Invitation, MemberRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Equipo' }

type Miembro = {
  membership_id: string
  user_id: string
  email: string
  rol: MemberRole
  desde: string
}

export default async function EquipoPage() {
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    supabase.rpc('miembros_del_consultorio').returns<Miembro[]>(),
    esDueño
      ? supabase
          .from('invitations')
          .select('id, email, token, status, expires_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .returns<Pick<Invitation, 'id' | 'email' | 'token' | 'status' | 'expires_at'>[]>()
      : Promise.resolve({ data: [] as Pick<Invitation, 'id' | 'email' | 'token' | 'status' | 'expires_at'>[] }),
  ])

  const equipo = miembros ?? []
  const pendientes = (invitaciones ?? []).filter((i) => new Date(i.expires_at) > new Date())

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Equipo</h1>
        <p className="mt-1 text-sm text-muted">
          Tu asistente puede gestionar la agenda y responder solicitudes. No puede
          borrar la cuenta ni invitar a nadie más.
        </p>
      </header>

      <section className="tarjeta mb-5 p-4 sm:p-5">
        <h2 className="font-semibold text-ink">Quién tiene acceso</h2>
        <ul className="mt-3 space-y-2">
          {equipo.map((m) => (
            <li
              key={m.membership_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium break-all text-ink">
                  {m.email}
                  {m.user_id === user?.id && (
                    <span className="ml-2 text-xs font-normal text-muted">(tú)</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {m.rol === 'owner' ? 'Dueño del consultorio' : 'Asistente'} · desde{' '}
                  {fechaCorta(m.desde, zona)}
                </p>
              </div>

              {esDueño && m.rol === 'assistant' && (
                <form action={quitarAsistente}>
                  <input type="hidden" name="id" value={m.membership_id} />
                  <QuitarAcceso email={m.email} />
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {esDueño ? (
        <>
          {pendientes.length > 0 && (
            <section className="tarjeta mb-5 p-4 sm:p-5">
              <h2 className="font-semibold text-ink">Invitaciones pendientes</h2>
              <ul className="mt-3 space-y-4">
                {pendientes.map((inv) => (
                  <li key={inv.id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm break-all text-muted">
                        {inv.email} · vence {fechaCorta(inv.expires_at, zona)}
                      </p>
                      <div className="flex items-center gap-3">
                        <RegenerarLiga id={inv.id} email={inv.email} />
                        <form action={cancelarInvitacion}>
                          <input type="hidden" name="id" value={inv.id} />
                          <button className="text-xs font-medium text-peligro hover:underline">
                            Cancelar invitación
                          </button>
                        </form>
                      </div>
                    </div>
                    <LigaInvitacion token={inv.token} email={inv.email} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="tarjeta p-4 sm:p-5">
            <h2 className="font-semibold text-ink">Invitar a alguien</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              La invitación queda atada a ese correo: si la liga llega a otra
              persona, no le sirve.
            </p>
            <InvitarAsistente />
          </section>
        </>
      ) : (
        <p className="text-sm text-muted">
          Solo el dueño del consultorio puede invitar o quitar accesos.
        </p>
      )}
    </>
  )
}
