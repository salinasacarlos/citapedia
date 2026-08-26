import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/marca'
import { AceptarInvitacion } from '@/components/aceptar-invitacion'
import type { MemberRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invitación' }

type Vista = {
  consultorio: string
  email: string
  rol: MemberRole
  estado: string
  vencida: boolean
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>
      <h1 className="mt-8 text-center text-2xl font-bold text-ink">{titulo}</h1>
      <div className="mt-3 text-center text-muted">{children}</div>
    </main>
  )
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('ver_invitacion', { p_token: token })
  const invitacion = (data as Vista[] | null)?.[0]

  if (!invitacion) {
    return (
      <Aviso titulo="Esta invitación no existe">
        <p>Puede que la liga esté incompleta. Pídele a tu doctor que te mande otra.</p>
      </Aviso>
    )
  }

  if (invitacion.vencida || invitacion.estado === 'expired') {
    return (
      <Aviso titulo="La invitación venció">
        <p>Las invitaciones duran 7 días. Pídele a tu doctor que te mande una nueva.</p>
      </Aviso>
    )
  }

  if (invitacion.estado !== 'pending') {
    return (
      <Aviso titulo="Esta invitación ya se usó">
        <p>
          Si ya tienes cuenta,{' '}
          <Link href="/login" className="font-medium text-acento hover:underline">
            entra normalmente
          </Link>
          .
        </p>
      </Aviso>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const destino = `/invitacion/${token}`

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>

      <div className="tarjeta mt-8 p-6 text-center">
        <p className="text-sm text-muted">Te invitaron a ayudar en</p>
        <h1 className="mt-1 text-xl font-bold text-ink">{invitacion.consultorio}</h1>
        <p className="mt-3 text-sm text-muted">
          Como asistente vas a poder ver la agenda, aceptar o rechazar solicitudes
          y administrar el horario. No podrás borrar la cuenta ni invitar a nadie
          más.
        </p>

        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm break-all">
          La invitación es para <strong className="font-semibold">{invitacion.email}</strong>
        </p>

        {user ? (
          user.email?.toLowerCase() === invitacion.email.toLowerCase() ? (
            <div className="mt-5">
              <AceptarInvitacion token={token} />
            </div>
          ) : (
            <div className="mt-5 text-sm">
              <p className="text-peligro">
                Entraste como {user.email}, y esta invitación es para otro correo.
              </p>
              <p className="mt-2 text-muted">
                Cierra sesión y vuelve a abrir esta liga con la cuenta correcta.
              </p>
            </div>
          )
        ) : (
          <div className="mt-5 space-y-2">
            <Link
              href={`/registro?next=${encodeURIComponent(destino)}&email=${encodeURIComponent(invitacion.email)}&asistente=1`}
              className="boton boton-primario w-full"
            >
              Crear mi cuenta
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(destino)}`}
              className="boton boton-suave w-full"
            >
              Ya tengo cuenta
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
