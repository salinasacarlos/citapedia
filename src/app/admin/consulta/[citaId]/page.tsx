import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { FormularioConsulta } from '@/components/nota-consulta'
import { Estudios, type EstudioVisible } from '@/components/estudios'
import { HistorialDeNota, type Version } from '@/components/historial-de-nota'
import { Recetas, type Receta } from '@/components/recetas'
import { AccionesCita } from '@/components/acciones-cita'
import { marcarCompletada, marcarNoAsistio } from '@/lib/admin/actions'
import { edad, fechaCorta, fechaLarga, hora } from '@/lib/fechas'
import type {
  ClinicalRecord,
  ConsultationFile,
  ConsultationNote,
  DeclaredRecord,
  Patient,
} from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Consulta' }

type CitaConPaciente = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
  patient_id: string | null
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

export default async function Consulta({
  params,
}: {
  params: Promise<{ citaId: string }>
}) {
  const { citaId } = await params
  const { profesional, esDueño } = await exigirConsultorio()
  const zona = profesional.timezone

  // La consulta es del médico. El asistente ve la agenda, no el expediente.
  if (!esDueño) {
    return (
      <div className="tarjeta p-6">
        <h1 className="font-bold text-ink">Esto lo abre el médico</h1>
        <p className="mt-2 text-sm text-muted">
          La consulta y el expediente son suyos. Tú puedes seguir con la agenda.
        </p>
        <Link href="/admin" className="boton boton-suave mt-4">
          Volver a la agenda
        </Link>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: cita } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, notes, patient_id')
    .eq('id', citaId)
    .maybeSingle<CitaConPaciente>()

  if (!cita?.patient_id) notFound()

  const { data: paciente } = await supabase
    .from('patients')
    .select('*')
    .eq('id', cita.patient_id)
    .maybeSingle<Patient>()

  if (!paciente) notFound()

  const [
    { data: expediente },
    { data: notas },
    { data: declarado },
    { data: archivos },
    { data: versiones },
    { count: citasFuturas },
    { data: recetas },
  ] = await Promise.all([
      supabase
        .from('clinical_records')
        .select('*')
        .eq('patient_id', paciente.id)
        .maybeSingle<ClinicalRecord>(),
      supabase
        .from('consultation_notes')
        .select('*')
        .eq('patient_id', paciente.id)
        .order('created_at', { ascending: false })
        .returns<ConsultationNote[]>(),
      supabase
        .from('declared_records')
        .select('*')
        .eq('patient_id', paciente.id)
        .maybeSingle<DeclaredRecord>(),
      supabase
        .from('consultation_files')
        .select('*')
        // Los archivados se conservan por la norma, pero no se muestran: para
        // el médico están borrados.
        .is('archived_at', null)
        .eq('patient_id', paciente.id)
        .order('created_at', { ascending: false })
        .returns<ConsultationFile[]>(),
      // Lo que decía antes esta nota. Va aquí y no en la bitácora porque es
      // donde alguien la está corrigiendo.
      supabase.rpc('historial_de_nota', { p_cita: cita.id }).returns<Version[]>(),
      // ¿Ya tiene algo agendado hacia adelante? Cambia lo que se le ofrece al
      // cerrar la consulta.
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', cita.patient_id)
        .in('status', ['requested', 'confirmed'])
        .gte('starts_at', new Date().toISOString()),
      // Lo recetado a este paciente, de lo más reciente hacia atrás: en
      // consulta la pregunta es qué trae encima hoy.
      supabase
        .rpc('recetas_del_paciente', { p_paciente: paciente.id })
        .returns<Receta[]>(),
    ])

  const todas = notas ?? []
  const nota = todas.find((n) => n.appointment_id === cita.id)
  // La consulta anterior es la referencia de siempre: qué tenía, qué se le dio.
  const previa = todas.find((n) => n.appointment_id !== cita.id)

  // El bucket es privado: cada archivo se abre con una liga firmada que vence.
  const estudios: EstudioVisible[] = await Promise.all(
    (archivos ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from('expedientes')
        .createSignedUrl(a.path, 60 * 15)
      return {
        id: a.id,
        filename: a.filename,
        kind: a.kind,
        mime: a.mime,
        size_bytes: a.size_bytes,
        created_at: a.created_at,
        url: data?.signedUrl ?? null,
      }
    }),
  )

  const años = edad(paciente.birth_date)
  const yaPaso = new Date(cita.ends_at) < new Date()
  const alertas = [expediente?.allergies, expediente?.conditions].filter(Boolean)

  return (
    <div className="@container">
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="min-w-0">
          <Link
            href={`/admin/pacientes/${paciente.id}`}
            className="text-xs font-semibold text-acento hover:underline"
          >
            ← Ficha de {paciente.name}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {paciente.name}
          </h1>
          <p className="text-sm text-muted">
            <span className="first-letter:uppercase">{fechaLarga(cita.starts_at, zona)}</span>
            {' · '}
            <span className="tabular-nums">{hora(cita.starts_at, zona)}</span>
            {años !== null && ` · ${años}`}
          </p>
        </div>

        {/* Cerrar la cita solo tiene sentido cuando ya ocurrió: antes, lo
            honesto es que siga abierta. */}
        {yaPaso && cita.status === 'confirmed' && (
          <AccionesCita
            id={cita.id}
            acciones={[
              { accion: marcarCompletada, etiqueta: 'Se atendió', tono: 'primario' },
              { accion: marcarNoAsistio, etiqueta: 'No asistió' },
            ]}
          />
        )}
      </div>

      {alertas.length > 0 && (
        <div className="mt-4 rounded-marca border border-peligro/30 bg-peligro-suave px-4 py-3">
          {expediente?.allergies && (
            <p className="text-sm">
              <span className="font-semibold text-peligro">Alergias: </span>
              {expediente.allergies}
            </p>
          )}
          {expediente?.conditions && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-peligro">Padecimientos: </span>
              {expediente.conditions}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 @4xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <section>
            <h2 className="mb-2 font-semibold text-ink">La consulta de hoy</h2>
            <FormularioConsulta
              citaId={cita.id}
              pacienteId={paciente.id}
              nota={nota}
              yaTieneCita={(citasFuturas ?? 0) > 0}
            />
            <HistorialDeNota versiones={versiones ?? []} zona={zona} />

            <div className="mt-4">
              <Recetas
                notaId={nota?.id ?? null}
                citaId={cita.id}
                pacienteId={paciente.id}
                recetas={recetas ?? []}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-ink">Estudios y documentos</h2>
            <Estudios
              pacienteId={paciente.id}
              citaId={cita.id}
              estudios={estudios}
              zona={zona}
            />
          </section>
        </div>

        <aside className="space-y-4">
          {cita.notes && (
            <div className="tarjeta p-4">
              <h3 className="text-sm font-semibold text-ink">Por qué vino</h3>
              <p className="mt-1 text-sm text-muted">{cita.notes}</p>
            </div>
          )}

          {declarado && !declarado.reviewed_at && (
            <div className="rounded-marca border border-acento/30 bg-acento-suave p-4">
              <h3 className="text-sm font-semibold text-acento">
                Lo que declaró el paciente
              </h3>
              <p className="mt-0.5 text-xs text-muted">Sin verificar.</p>
              <dl className="mt-2 space-y-1.5">
                {declarado.allergies && (
                  <Dato etiqueta="Alergias" valor={declarado.allergies} />
                )}
                {declarado.conditions && (
                  <Dato etiqueta="Padecimientos" valor={declarado.conditions} />
                )}
                {declarado.medications && (
                  <Dato etiqueta="Medicamentos" valor={declarado.medications} />
                )}
              </dl>
              <Link
                href={`/admin/pacientes/${paciente.id}`}
                className="mt-3 inline-block text-xs font-semibold text-acento hover:underline"
              >
                Revisarlo en la ficha →
              </Link>
            </div>
          )}

          {previa && (
            <div className="tarjeta p-4">
              <h3 className="text-sm font-semibold text-ink">La vez pasada</h3>
              {previa.created_at && (
                <p className="mt-0.5 text-xs text-muted first-letter:uppercase">
                  {fechaCorta(previa.created_at, zona)}
                </p>
              )}
              {vitales(previa).length > 0 && (
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs tabular-nums text-brand">
                  {vitales(previa).map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </p>
              )}
              <dl className="mt-2 space-y-1.5">
                <Dato etiqueta="Diagnóstico" valor={previa.diagnosis} />
                <Dato etiqueta="Tratamiento" valor={previa.treatment} />
                <Dato etiqueta="Nota" valor={previa.note} />
              </dl>
            </div>
          )}

          <div className="tarjeta p-4">
            <h3 className="text-sm font-semibold text-ink">Contacto</h3>
            <p className="mt-0.5 text-xs text-muted">
              {paciente.is_minor ? `Se le avisa a ${paciente.tutor_name ?? 'su tutor'}.` : 'Se avisa al paciente directamente.'}
            </p>
            <dl className="mt-2 space-y-1.5">
              <Dato
                etiqueta="Teléfono"
                valor={paciente.is_minor ? paciente.tutor_phone : paciente.phone}
              />
              <Dato etiqueta="Tipo de sangre" valor={expediente?.blood_type} />
              <Dato etiqueta="Seguro" valor={paciente.insurance} />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
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
