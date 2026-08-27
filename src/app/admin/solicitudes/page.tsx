import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { aceptarCita, marcarVencidas, rechazarCita } from '@/lib/admin/actions'
import { AccionesCita } from '@/components/acciones-cita'
import { EstadoVacio } from '@/components/estado-vacio'
import { Filtros } from '@/components/filtros'
import { CitaAceptada } from '@/components/cita-aceptada'
import { aplicarFiltros, hayFiltros, leerFiltros } from '@/lib/filtros'
import { fechaLarga, hora, rangoHorario, relativo } from '@/lib/fechas'
import { armarMensaje, contactoParaConfirmar } from '@/lib/whatsapp'
import type { Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Solicitudes' }

type Solicitud = {
  id: string
  starts_at: string
  ends_at: string
  notes: string | null
  created_at: string | null
  patients: Pick<Patient, 'name' | 'phone' | 'email'> | null
}

/** Agrupa por día, igual que la agenda: una lista plana de fechas cuesta leer. */
function agruparPorDia(solicitudes: Solicitud[], zona: string) {
  const porDia = new Map<string, Solicitud[]>()
  for (const s of solicitudes) {
    const dia = fechaLarga(s.starts_at, zona)
    porDia.set(dia, [...(porDia.get(dia) ?? []), s])
  }
  return [...porDia.entries()]
}

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtros = leerFiltros(params)
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  // `!inner` solo al buscar: si no, excluiría citas sin paciente.
  const relacion = filtros.q
    ? 'patients!inner(name, phone, email)'
    : 'patients(name, phone, email)'

  const { data } = await aplicarFiltros(
    supabase
      .from('appointments')
      .select(`id, starts_at, ends_at, notes, created_at, ${relacion}`),
    filtros,
    zona,
    ['requested'],
  )
    .order('starts_at')
    .returns<Solicitud[]>()

  // La cita recién aceptada viaja por la URL: la lista ya no la contiene
  // (dejó de estar `requested`) y su liga se necesita justo en ese momento.
  const tokenAceptada = typeof params.aceptada === 'string' ? params.aceptada : null
  const { data: aceptada } = tokenAceptada
    ? await supabase
        .from('appointments')
        .select(
          'access_token, starts_at, patients(name, phone, is_minor, tutor_name, tutor_phone)',
        )
        .eq('access_token', tokenAceptada)
        .maybeSingle<{
          access_token: string
          starts_at: string
          patients: Pick<
            Patient,
            'name' | 'phone' | 'is_minor' | 'tutor_name' | 'tutor_phone'
          > | null
        }>()
    : { data: null }

  const { data: ajustes } = await supabase
    .from('reminder_settings')
    .select('message_template')
    .maybeSingle<{ message_template: string | null }>()

  const base =
    ajustes?.message_template ??
    'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.'
  const plantilla = base.includes('{liga}') ? base : `${base} Aquí puedes confirmar: {liga}`
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const ahora = new Date().toISOString()
  const todas = data ?? []

  // Filtrando por estado, lo que se ve ya está decidido: no hay nada que
  // aceptar, ni que separar por hora, y ofrecer los botones sería mentir.
  const decidido = filtros.estado !== ''
  // Una solicitud cuyo horario ya pasó no se puede aceptar: nadie la atendió
  // a tiempo. Se separa para no mezclarla con lo que sí requiere decisión.
  const pendientes = decidido ? todas : todas.filter((s) => s.starts_at >= ahora)
  const vencidas = decidido ? [] : todas.filter((s) => s.starts_at < ahora)

  // Dos solicitudes al mismo horario compiten: aceptar una deja fuera a la otra.
  const porHorario = new Map<string, number>()
  for (const s of pendientes) {
    porHorario.set(s.starts_at, (porHorario.get(s.starts_at) ?? 0) + 1)
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Solicitudes</h1>
        <p className="mt-1 text-sm text-muted">
          {decidido
            ? `${pendientes.length} ${
                pendientes.length === 1 ? 'solicitud' : 'solicitudes'
              } ${
                filtros.estado === 'rejected'
                  ? 'que rechazaste'
                  : pendientes.length === 1
                    ? 'que venció'
                    : 'que vencieron'
              }. Ya no ${pendientes.length === 1 ? 'requiere' : 'requieren'} nada de ti.`
            : pendientes.length === 0
              ? hayFiltros(filtros)
                ? 'Ninguna solicitud coincide con estos filtros.'
                : 'Nada pendiente por revisar.'
              : `${pendientes.length} ${
                  pendientes.length === 1 ? 'paciente espera' : 'pacientes esperan'
                } tu respuesta. Hasta que aceptes, el horario sigue libre.`}
        </p>
      </header>

      {aceptada?.patients && (
        <CitaAceptada
          paciente={aceptada.patients.name}
          liga={`${sitio}/cita/${aceptada.access_token}`}
          telefono={contactoParaConfirmar(aceptada.patients)?.telefono ?? null}
          correo={
            params.correo === 'enviado'
              ? 'enviado'
              : params.correo === 'falla'
                ? 'falla'
                : 'sin-correo'
          }
          mensaje={armarMensaje(plantilla, {
            paciente:
              contactoParaConfirmar(aceptada.patients)?.nombre ?? aceptada.patients.name,
            doctor: profesional.name,
            fecha: fechaLarga(aceptada.starts_at, zona),
            hora: hora(aceptada.starts_at, zona),
            liga: `${sitio}/cita/${aceptada.access_token}`,
          })}
        />
      )}

      <Filtros
        ruta="/admin/solicitudes"
        etiquetaEstado="Estado"
        etiquetaTodos="Por revisar"
        estados={[
          { valor: 'rejected', etiqueta: 'Rechazadas' },
          { valor: 'expired', etiqueta: 'Vencidas y archivadas' },
        ]}
      />

      {vencidas.length > 0 && (
        <section className="mb-8 rounded-marca border border-border bg-surface-2 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">
            {vencidas.length} {vencidas.length === 1 ? 'solicitud venció' : 'solicitudes vencieron'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Su horario ya pasó sin respuesta, así que ya no se pueden aceptar.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {vencidas.map((s) => (
              <li key={s.id}>
                {s.patients?.name ?? 'Paciente sin nombre'} ·{' '}
                <span className="first-letter:uppercase">{fechaLarga(s.starts_at, zona)}</span>
              </li>
            ))}
          </ul>
          <form action={marcarVencidas} className="mt-4">
            <button className="boton boton-suave text-xs">Archivar vencidas</button>
          </form>
        </section>
      )}

      {pendientes.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros(filtros) ? 'Nada coincide' : 'Sin solicitudes por ahora'}
        >
          {hayFiltros(filtros)
            ? 'Prueba con otro nombre o amplía el rango de fechas.'
            : 'Cuando alguien pida cita desde tu página pública, aparecerá aquí para que la aceptes o la rechaces.'}
        </EstadoVacio>
      ) : (
        <div className="space-y-8">
          {agruparPorDia(pendientes, zona).map(([dia, delDia]) => (
            <section key={dia}>
              <h2 className="mb-3 text-sm font-semibold text-muted first-letter:uppercase">
                {dia}
              </h2>
              <ul className="space-y-3">
                {delDia.map((s) => {
            const compiten = (porHorario.get(s.starts_at) ?? 0) > 1
            const contacto = [s.patients?.phone, s.patients?.email].filter(Boolean)

            return (
              <li key={s.id} className="tarjeta p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-semibold text-ink">
                    {s.patients?.name ?? 'Paciente sin nombre'}
                  </h2>
                  {s.created_at && (
                    <span className="text-xs whitespace-nowrap text-muted">
                      Pidió {relativo(s.created_at)}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm whitespace-nowrap tabular-nums text-muted">
                  {rangoHorario(s.starts_at, s.ends_at, zona)}
                </p>

                {contacto.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {contacto.map((dato) => (
                      <span key={dato} className="break-all text-muted">
                        {dato}
                      </span>
                    ))}
                  </p>
                )}

                {s.notes && (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm leading-relaxed">
                    {s.notes}
                  </p>
                )}

                {compiten && (
                  <p className="mt-3 text-xs font-medium text-alerta">
                    Otro paciente pidió este mismo horario. Al aceptar uno, el otro se
                    queda sin lugar.
                  </p>
                )}

                {/* Ya decidida, no hay nada que aceptar ni que rechazar. */}
                {!decidido && (
                  <div className="mt-4">
                    <AccionesCita
                      id={s.id}
                      acciones={[
                        { accion: aceptarCita, etiqueta: 'Aceptar', tono: 'primario' },
                        { accion: rechazarCita, etiqueta: 'Rechazar', tono: 'peligro' },
                      ]}
                    />
                  </div>
                )}
              </li>
            )
          })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
