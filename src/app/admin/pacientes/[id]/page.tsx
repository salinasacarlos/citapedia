import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { EstadoVacio } from '@/components/estado-vacio'
import { NotaConsulta } from '@/components/nota-consulta'
import { edad, fechaCorta, fechaSuelta, hora } from '@/lib/fechas'
import type {
  AppointmentStatus,
  ClinicalRecord,
  ConsultationNote,
  Patient,
} from '@/lib/database.types'

export const dynamic = 'force-dynamic'

const DESENLACE: Partial<Record<AppointmentStatus, { texto: string; clase: string }>> = {
  confirmed: { texto: 'Confirmada', clase: 'bg-brand-suave text-brand' },
  requested: { texto: 'Solicitada', clase: 'bg-surface-2 text-muted' },
  completed: { texto: 'Se atendió', clase: 'bg-exito-suave text-exito' },
  no_show: { texto: 'No asistió', clase: 'bg-alerta-suave text-alerta' },
  rejected: { texto: 'Rechazada', clase: 'bg-surface-2 text-muted' },
  expired: { texto: 'Venció', clase: 'bg-surface-2 text-muted' },
  cancelled_by_patient: { texto: 'Canceló el paciente', clase: 'bg-peligro-suave text-peligro' },
  cancelled_by_professional: { texto: 'Cancelaste tú', clase: 'bg-peligro-suave text-peligro' },
  rescheduled: { texto: 'Reagendada', clase: 'bg-acento-suave text-acento' },
}

type Cita = {
  id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
}

/** Los signos que sí se midieron, en una línea. */
function vitales(n: ConsultationNote): string[] {
  const partes: string[] = []
  if (n.weight_kg) partes.push(`${n.weight_kg} kg`)
  if (n.height_cm) partes.push(`${n.height_cm} cm`)
  if (n.temperature_c) partes.push(`${n.temperature_c} °C`)
  if (n.blood_pressure) partes.push(`PA ${n.blood_pressure}`)
  if (n.heart_rate) partes.push(`${n.heart_rate} lpm`)
  if (n.oxygen_saturation) partes.push(`SatO₂ ${n.oxygen_saturation}%`)
  return partes
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor) return null
  return (
    <div>
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm break-words text-foreground">{valor}</dd>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select('name')
    .eq('id', id)
    .maybeSingle<{ name: string }>()
  return { title: data?.name ?? 'Paciente' }
}

export default async function FichaPaciente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  // RLS decide: un paciente de otro consultorio simplemente no aparece.
  const { data: paciente } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle<Patient>()

  if (!paciente) notFound()

  const [{ data: citas }, { data: expediente }, { data: consultas }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, notes')
      .eq('patient_id', id)
      .order('starts_at', { ascending: false })
      .returns<Cita[]>(),
    esDueño
      ? supabase
          .from('clinical_records')
          .select('*')
          .eq('patient_id', id)
          .maybeSingle<ClinicalRecord>()
      : Promise.resolve({ data: null }),
    esDueño
      ? supabase
          .from('consultation_notes')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false })
          .returns<ConsultationNote[]>()
      : Promise.resolve({ data: [] as ConsultationNote[] }),
  ])

  const historial = citas ?? []
  const notas = consultas ?? []
  const notaPorCita = new Map(notas.map((n) => [n.appointment_id, n]))
  const años = edad(paciente.birth_date)
  const ultimaMedida = notas.find((n) => n.weight_kg || n.height_cm)

  return (
    <>
      <Link href="/admin/pacientes" className="text-sm text-acento hover:underline">
        ← Pacientes
      </Link>

      <header className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{paciente.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
            {años && <span>{años}</span>}
            {paciente.birth_date && (
              <>
                {años && <span aria-hidden>·</span>}
                <span>{fechaSuelta(paciente.birth_date)}</span>
              </>
            )}
            {paciente.sex && (
              <>
                <span aria-hidden>·</span>
                <span className="capitalize">{paciente.sex}</span>
              </>
            )}
          </p>
          {paciente.is_minor && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-acento-suave px-2.5 py-1 text-xs font-medium text-acento">
              Depende de {paciente.tutor_name ?? 'un responsable'}
              {paciente.tutor_relationship && ` · ${paciente.tutor_relationship}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/pacientes/${paciente.id}/exportar`}
            className="boton boton-suave"
            download
          >
            Excel
          </a>
          <Link href={`/admin/pacientes/${paciente.id}/editar`} className="boton boton-suave">
            Editar datos
          </Link>
          {esDueño && (
            <Link
              href={`/admin/pacientes/${paciente.id}/expediente`}
              className="boton boton-primario"
            >
              Editar expediente
            </Link>
          )}
        </div>
      </header>

      {/* Las alertas van arriba y en rojo: enterrarlas en una lista es donde
          se pierden justo cuando importan. */}
      {esDueño && (expediente?.allergies || expediente?.conditions) && (
        <div className="mb-5 rounded-marca border border-peligro/30 bg-peligro-suave/40 p-4">
          {expediente.allergies && (
            <p className="text-sm">
              <span className="font-semibold text-peligro">Alergias:</span>{' '}
              <span className="text-foreground">{expediente.allergies}</span>
            </p>
          )}
          {expediente.conditions && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-alerta">Padecimientos:</span>{' '}
              <span className="text-foreground">{expediente.conditions}</span>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <section className="tarjeta p-4 sm:p-5">
            <h2 className="mb-1 font-semibold text-ink">Contacto</h2>
            {/* Decir de quién es cada dato: el enredo de antes venía de que un
                teléfono suelto no dice si es del paciente o de quien agenda. */}
            <p className="mb-3 text-xs text-muted">
              {paciente.is_minor
                ? 'Se avisa a quien responde por el paciente.'
                : 'Se avisa al paciente directamente.'}
            </p>
            <dl className="space-y-3">
              {paciente.is_minor && (
                <>
                  <Dato
                    etiqueta={`${paciente.tutor_relationship ?? 'Responsable'} — se le avisa a`}
                    valor={paciente.tutor_name}
                  />
                  <Dato etiqueta="Su teléfono" valor={paciente.tutor_phone} />
                </>
              )}
              <Dato
                etiqueta={paciente.is_minor ? 'Teléfono del paciente' : 'Teléfono'}
                valor={paciente.phone}
              />
              <Dato
                etiqueta={paciente.is_minor ? 'Correo del paciente' : 'Correo'}
                valor={paciente.email}
              />
              <Dato etiqueta="Seguro" valor={paciente.insurance} />
              <Dato etiqueta="Notas de recepción" valor={paciente.notes} />
            </dl>
            {!paciente.phone && !paciente.email && !paciente.tutor_phone && (
              <p className="text-sm text-muted">Sin datos de contacto.</p>
            )}
          </section>

          {paciente.emergency_contact_name && (
            <section className="tarjeta p-4 sm:p-5">
              <h2 className="mb-3 font-semibold text-ink">En caso de emergencia</h2>
              <dl className="space-y-3">
                <Dato
                  etiqueta={paciente.emergency_contact_relationship ?? 'Contacto'}
                  valor={paciente.emergency_contact_name}
                />
                <Dato etiqueta="Teléfono" valor={paciente.emergency_contact_phone} />
              </dl>
            </section>
          )}

          {esDueño && (
            <section className="tarjeta p-4 sm:p-5">
              <h2 className="mb-3 font-semibold text-ink">Expediente</h2>
              {expediente ? (
                <dl className="space-y-3">
                  <Dato etiqueta="Medicamentos" valor={expediente.medications} />
                  <Dato etiqueta="Tipo de sangre" valor={expediente.blood_type} />
                  <Dato etiqueta="Vacunas" valor={expediente.immunizations} />
                  <Dato etiqueta="Cirugías y hospitalizaciones" valor={expediente.surgical_history} />
                  <Dato etiqueta="Antecedentes familiares" valor={expediente.family_history} />
                  <Dato etiqueta="Hábitos" valor={expediente.habits} />
                  <Dato etiqueta="Notas" valor={expediente.notes} />
                </dl>
              ) : (
                <p className="text-sm text-muted">
                  Todavía no hay expediente para este paciente.
                </p>
              )}

              {ultimaMedida && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs text-muted">Última somatometría</p>
                  <p className="mt-1 text-sm tabular-nums">
                    {ultimaMedida.weight_kg && `${ultimaMedida.weight_kg} kg`}
                    {ultimaMedida.weight_kg && ultimaMedida.height_cm && ' · '}
                    {ultimaMedida.height_cm && `${ultimaMedida.height_cm} cm`}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        <section>
          <h2 className="mb-3 font-semibold text-ink">
            Historial de citas ({historial.length})
          </h2>

          {historial.length === 0 ? (
            <EstadoVacio titulo="Sin citas todavía" />
          ) : (
            <ul className="space-y-2">
              {historial.map((cita) => {
                const desenlace = DESENLACE[cita.status]
                const nota = notaPorCita.get(cita.id)
                return (
                  <li key={cita.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        <span className="first-letter:uppercase">
                          {fechaCorta(cita.starts_at, zona)}
                        </span>
                        <span className="mx-2 text-border">·</span>
                        <span className="tabular-nums text-muted">
                          {hora(cita.starts_at, zona)}
                        </span>
                      </p>
                      {desenlace && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${desenlace.clase}`}
                        >
                          {desenlace.texto}
                        </span>
                      )}
                    </div>

                    {cita.notes && (
                      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                        <span className="text-xs text-muted">Lo que pidió: </span>
                        {cita.notes}
                      </p>
                    )}

                    {esDueño && nota && (
                      <div className="mt-2 rounded-lg border border-brand/20 bg-brand-suave/40 px-3 py-2">
                        {vitales(nota).length > 0 && (
                          <p className="flex flex-wrap gap-x-3 text-xs tabular-nums text-brand">
                            {vitales(nota).map((v) => (
                              <span key={v}>{v}</span>
                            ))}
                          </p>
                        )}
                        {nota.diagnosis && (
                          <p className="mt-1 text-sm">
                            <span className="text-xs text-muted">Diagnóstico: </span>
                            {nota.diagnosis}
                          </p>
                        )}
                        {nota.treatment && (
                          <p className="mt-1 text-sm">
                            <span className="text-xs text-muted">Tratamiento: </span>
                            {nota.treatment}
                          </p>
                        )}
                        {nota.note && (
                          <p className="mt-1 text-sm whitespace-pre-line">{nota.note}</p>
                        )}
                      </div>
                    )}

                    {esDueño && (
                      <NotaConsulta citaId={cita.id} pacienteId={paciente.id} nota={nota} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
