import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { cancelarCita, marcarCompletada, marcarNoAsistio } from '@/lib/admin/actions'
import { AccionesCita } from '@/components/acciones-cita'
import { ConfirmarAsistencia, type DatosConfirmacion } from '@/components/confirmar-asistencia'
import { contactoParaConfirmar } from '@/lib/whatsapp'
import { EstadoVacio } from '@/components/estado-vacio'
import { Filtros } from '@/components/filtros'
import { VistaAgenda } from '@/components/vista-agenda'
import { hayFiltros, leerFiltros } from '@/lib/filtros'
import { duracion, fechaCorta, fechaLarga, hora } from '@/lib/fechas'
import type { Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agenda' }

type Cita = {
  id: string
  access_token: string
  starts_at: string
  ends_at: string
  notes: string | null
  confirmation_sent_at: string | null
  patient_confirmed_at: string | null
  patients: Pick<
    Patient,
    'name' | 'phone' | 'is_minor' | 'tutor_name' | 'tutor_phone'
  > | null
}

function agruparPorDia(citas: Cita[], zona: string) {
  const porDia = new Map<string, Cita[]>()
  for (const cita of citas) {
    const dia = fechaLarga(cita.starts_at, zona)
    porDia.set(dia, [...(porDia.get(dia) ?? []), cita])
  }
  return [...porDia.entries()]
}

function FilaCita({
  cita,
  zona,
  acciones,
  conFecha = false,
}: {
  cita: Cita
  zona: string
  acciones: React.ReactNode
  /** En "por cerrar" las citas no van agrupadas por día: la fecha va en la fila. */
  conFecha?: boolean
}) {
  return (
    <li className="tarjeta p-4 sm:p-5">
      <div className="sm:flex sm:items-start sm:gap-5">
        {/* La hora manda: en escritorio va en su propia columna. */}
        <div className="shrink-0 sm:w-24">
          {conFecha && (
            <p className="text-xs text-muted first-letter:uppercase">
              {fechaCorta(cita.starts_at, zona)}
            </p>
          )}
          <p className="font-semibold tabular-nums text-ink">{hora(cita.starts_at, zona)}</p>
        </div>

        <div className="mt-1 min-w-0 flex-1 sm:mt-0">
          <p className="font-semibold text-ink">
            {cita.patients?.name ?? 'Paciente sin nombre'}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted">
            <span className="whitespace-nowrap">{duracion(cita.starts_at, cita.ends_at)}</span>
            {cita.patients?.phone && (
              <>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">{cita.patients.phone}</span>
              </>
            )}
          </p>
          {cita.notes && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{cita.notes}</p>
          )}
        </div>
      </div>
      <div className="mt-4 sm:mt-3 sm:pl-29">{acciones}</div>
    </li>
  )
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filtros = leerFiltros(await searchParams)
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone
  const ahora = new Date().toISOString()
  // Más atrás que esto ya es historial, no pendiente de cerrar.
  const hace30Dias = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [{ data: confirmadas }, { count: porRevisar }, { count: franjas }] = await Promise.all([
    (filtros.q
      ? supabase
          .from('appointments')
          .select(
            'id, access_token, starts_at, ends_at, notes, confirmation_sent_at, patient_confirmed_at, patients!inner(name, phone, is_minor, tutor_name, tutor_phone)',
          )
          .or(
            `name.ilike.*${filtros.q.replace(/[,()*]/g, '')}*,phone.ilike.*${filtros.q.replace(/[,()*]/g, '')}*`,
            { referencedTable: 'patients' },
          )
      : supabase
          .from('appointments')
          .select(
            'id, access_token, starts_at, ends_at, notes, confirmation_sent_at, patient_confirmed_at, patients(name, phone, is_minor, tutor_name, tutor_phone)',
          )
    )
      .eq('status', 'confirmed')
      .gte('starts_at', hace30Dias)
      .order('starts_at')
      .limit(100)
      .returns<Cita[]>(),
    // Solo las que todavía se pueden aceptar: las vencidas no piden decisión.
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'requested')
      .gte('starts_at', ahora),
    supabase.from('availability').select('id', { count: 'exact', head: true }),
  ])

  const { data: recordatorios } = await supabase
    .from('reminder_settings')
    .select('message_template')
    .maybeSingle<{ message_template: string | null }>()

  // Si el médico no puso {liga} en su plantilla, se agrega al final: es lo que
  // deja al paciente confirmar solo y adelantar sus datos.
  const base =
    recordatorios?.message_template ??
    'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.'
  const plantilla = base.includes('{liga}') ? base : `${base} Aquí puedes confirmar: {liga}`

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  /** Lo que el componente de confirmación necesita para armar el mensaje. */
  function datosConfirmacion(cita: Cita): DatosConfirmacion {
    return {
      citaId: cita.id,
      contacto: cita.patients ? contactoParaConfirmar(cita.patients) : null,
      plantilla,
      paciente: cita.patients?.name ?? 'el paciente',
      doctor: profesional.name,
      fecha: fechaLarga(cita.starts_at, zona),
      hora: hora(cita.starts_at, zona),
      contactadoEn: cita.confirmation_sent_at,
      confirmadaEn: cita.patient_confirmed_at,
      liga: `${sitio}/cita/${cita.access_token}`,
    }
  }

  const todas = confirmadas ?? []
  // Una cita que ya terminó sigue confirmada hasta que el consultorio dice
  // qué pasó. Si no se listan, quedan colgadas para siempre.
  const porCerrar = todas.filter((c) => c.ends_at < ahora)
  const proximas = todas.filter((c) => c.ends_at >= ahora)

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Tu agenda</h1>
          <p className="mt-1 text-sm text-muted">Lo que sigue y lo que quedó por cerrar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <VistaAgenda actual="lista" />
          <Link href="/admin/agendar" className="boton boton-primario">
            Nueva cita
          </Link>
          {(porRevisar ?? 0) > 0 && (
            <Link href="/admin/solicitudes" className="boton boton-suave">
              {porRevisar} {porRevisar === 1 ? 'solicitud' : 'solicitudes'} por revisar
            </Link>
          )}
        </div>
      </header>

      <Filtros
        ruta="/admin"
        conFechas={false}
        placeholder="Buscar paciente por nombre o teléfono"
      />

      {(franjas ?? 0) === 0 && (
        <div className="mb-6 rounded-marca border border-alerta/30 bg-alerta-suave px-5 py-4">
          <p className="text-sm font-semibold text-alerta">Todavía no defines tu horario</p>
          <p className="mt-1 text-sm text-muted">
            Sin horario, tu página pública no puede ofrecer ningún hueco.{' '}
            <Link href="/admin/horario" className="font-medium text-acento hover:underline">
              Defínelo ahora
            </Link>
            .
          </p>
        </div>
      )}

      {porCerrar.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-alerta">
            Por cerrar ({porCerrar.length})
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Ya pasaron. Di qué ocurrió para que salgan de tu agenda.
          </p>
          <ul className="space-y-3">
            {porCerrar.map((cita) => (
              <FilaCita
                key={cita.id}
                cita={cita}
                zona={zona}
                conFecha
                acciones={
                  <AccionesCita
                    id={cita.id}
                    acciones={[
                      { accion: marcarCompletada, etiqueta: 'Se atendió', tono: 'primario' },
                      { accion: marcarNoAsistio, etiqueta: 'No asistió' },
                    ]}
                  />
                }
              />
            ))}
          </ul>
        </section>
      )}

      {proximas.length === 0 ? (
        /* Si la búsqueda ya encontró algo arriba, no tiene sentido decir que
           nada coincide: solo falta decir que en lo próximo no hay nada. */
        porCerrar.length > 0 ? (
          <p className="text-sm text-muted">Nada más próximo con esta búsqueda.</p>
        ) : (
          <EstadoVacio
            titulo={hayFiltros(filtros) ? 'Ningún paciente coincide' : 'No tienes citas próximas'}
          >
            {hayFiltros(filtros)
              ? 'Prueba con otro nombre, o búscalo en el Historial si su cita ya se cerró.'
              : 'Las que aceptes en Solicitudes aparecerán aquí, ordenadas por día.'}
          </EstadoVacio>
        )
      ) : (
        <div className="space-y-8">
          {agruparPorDia(proximas, zona).map(([dia, delDia]) => (
            <section key={dia}>
              <h2 className="mb-3 text-sm font-semibold text-muted first-letter:uppercase">
                {dia}
              </h2>
              <ul className="space-y-3">
                {delDia.map((cita) => (
                  <FilaCita
                    key={cita.id}
                    cita={cita}
                    zona={zona}
                    acciones={
                      /* Todavía no ocurre: confirmar con el paciente, moverla
                         o cancelarla. Cerrarla se habilita cuando ya pasó. */
                      <div className="flex flex-col gap-3">
                        <ConfirmarAsistencia datos={datosConfirmacion(cita)} />
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/reagendar/${cita.id}`}
                            className="boton boton-suave px-3 py-1.5 text-xs"
                          >
                            Reagendar
                          </Link>
                          <AccionesCita
                            id={cita.id}
                            acciones={[
                              { accion: cancelarCita, etiqueta: 'Cancelar', tono: 'peligro' },
                            ]}
                          />
                        </div>
                      </div>
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
