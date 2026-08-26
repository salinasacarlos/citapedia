import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/marca'
import { AccionesCitaPaciente } from '@/components/acciones-cita-paciente'
import { DeclararDatos } from '@/components/declarar-datos'
import { duracion, fechaLarga, hora } from '@/lib/fechas'
import type { AppointmentStatus } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tu cita' }

type Vista = {
  cita_id: string
  consultorio: string
  slug: string
  direccion: string | null
  telefono: string | null
  zona: string
  paciente: string | null
  inicio: string
  fin: string
  estado: AppointmentStatus
  confirmada_por_paciente: boolean
  ya_declaro: boolean
}

/** Qué decirle al paciente según en qué quedó su cita. */
const DESENLACE: Partial<Record<AppointmentStatus, { titulo: string; texto: string }>> = {
  requested: {
    titulo: 'Tu solicitud está en revisión',
    texto: 'El consultorio la va a revisar y te avisa. Todavía no está apartada.',
  },
  rejected: {
    titulo: 'El consultorio no pudo tomar esta cita',
    texto: 'Puedes buscar otro horario en su página.',
  },
  expired: {
    titulo: 'Esta solicitud venció',
    texto: 'Nadie alcanzó a responderla a tiempo. Puedes pedir otra.',
  },
  cancelled_by_patient: {
    titulo: 'Cancelaste esta cita',
    texto: 'Si cambias de opinión, puedes agendar otra en la página del consultorio.',
  },
  cancelled_by_professional: {
    titulo: 'El consultorio canceló esta cita',
    texto: 'Comunícate con ellos para reagendarla.',
  },
  rescheduled: {
    titulo: 'Esta cita se movió',
    texto: 'El consultorio te dio otro horario. Busca la liga nueva que te mandaron.',
  },
  completed: { titulo: 'Esta consulta ya se atendió', texto: 'Gracias por venir.' },
  no_show: {
    titulo: 'Esta cita quedó sin asistir',
    texto: 'Si necesitas otra, agéndala en la página del consultorio.',
  },
}

export default async function CitaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('ver_cita', { p_token: token })
  const cita = (data as Vista[] | null)?.[0]

  if (!cita) {
    return (
      <Marco>
        <h1 className="text-xl font-bold text-ink">No encontramos esta cita</h1>
        <p className="mt-2 text-sm text-muted">
          Puede que la liga esté incompleta. Pídesela otra vez al consultorio.
        </p>
      </Marco>
    )
  }

  const zona = cita.zona
  const yaPaso = new Date(cita.fin) < new Date()
  const desenlace = DESENLACE[cita.estado]
  const puedeActuar = cita.estado === 'confirmed' && !yaPaso

  return (
    <Marco>
      <div className="text-center">
        <p className="text-sm text-muted">Tu cita con</p>
        <h1 className="mt-1 text-xl font-bold text-ink">{cita.consultorio}</h1>
      </div>

      <div className="mt-5 rounded-marca bg-brand-suave px-4 py-4 text-center">
        <p className="text-lg font-bold text-ink first-letter:uppercase">
          {fechaLarga(cita.inicio, zona)}
        </p>
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-brand">
          {hora(cita.inicio, zona)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {duracion(cita.inicio, cita.fin)}
          {cita.paciente && ` · para ${cita.paciente}`}
        </p>
      </div>

      {(cita.direccion || cita.telefono) && (
        <div className="mt-4 space-y-1 text-center text-sm text-muted">
          {cita.direccion && <p>{cita.direccion}</p>}
          {cita.telefono && <p className="tabular-nums">{cita.telefono}</p>}
        </div>
      )}

      {desenlace ? (
        <div className="mt-6 rounded-marca border border-border bg-surface-2 p-4 text-center">
          <p className="font-semibold text-ink">{desenlace.titulo}</p>
          <p className="mt-1 text-sm text-muted">{desenlace.texto}</p>
          <Link href={`/${cita.slug}`} className="boton boton-suave mt-4">
            Ver la página del consultorio
          </Link>
        </div>
      ) : yaPaso ? (
        <p className="mt-6 text-center text-sm text-muted">Esta cita ya pasó.</p>
      ) : null}

      {puedeActuar && (
        <AccionesCitaPaciente
          token={token}
          yaConfirmo={cita.confirmada_por_paciente}
        />
      )}

      {/* Adelantar datos médicos sirve mientras la cita siga en pie. */}
      {!yaPaso &&
        (cita.estado === 'confirmed' || cita.estado === 'requested') &&
        !cita.ya_declaro && (
          <div className="mt-6">
            <DeclararDatos citaId={token} medico={cita.consultorio} />
          </div>
        )}
    </Marco>
  )
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>
      <div className="tarjeta mt-8 p-5 sm:p-6">{children}</div>
      <p className="mt-6 text-center text-xs text-muted">Agenda gestionada con CitaPedia.</p>
    </main>
  )
}
