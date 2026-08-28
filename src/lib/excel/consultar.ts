import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { construirExpediente, nombreArchivo, type CitaExport } from '@/lib/excel/expediente'
import type { ClinicalRecord, ConsultationNote, Patient } from '@/lib/database.types'

/**
 * Arma el archivo con lo que quien pide TIENE derecho a ver.
 *
 * Las consultas clínicas ni siquiera se lanzan si es un asistente: RLS las
 * devolvería vacías igual, pero pedirlas y confiar en que vengan vacías es
 * apoyarse en un efecto secundario. Mejor no pedirlas.
 */
export async function exportarPacientes(filtroPaciente?: string, hojas?: string[]) {
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()

  let consultaPacientes = supabase.from('patients').select('*').order('name')
  if (filtroPaciente) consultaPacientes = consultaPacientes.eq('id', filtroPaciente)
  const { data: pacientes } = await consultaPacientes.returns<Patient[]>()

  if (!pacientes || pacientes.length === 0) return null

  const ids = pacientes.map((p) => p.id)

  const [{ data: citas }, expedientes, consultas] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, patient_id, starts_at, ends_at, status, notes')
      .in('patient_id', ids)
      .order('starts_at', { ascending: false })
      .returns<CitaExport[]>(),
    esDueño
      ? supabase
          .from('clinical_records')
          .select('*')
          .in('patient_id', ids)
          .returns<ClinicalRecord[]>()
      : Promise.resolve({ data: [] as ClinicalRecord[] }),
    esDueño
      ? supabase
          .from('consultation_notes')
          .select('*')
          .in('patient_id', ids)
          .order('created_at', { ascending: false })
          .returns<ConsultationNote[]>()
      : Promise.resolve({ data: [] as ConsultationNote[] }),
  ])

  const buffer = await construirExpediente({
    consultorio: profesional.name,
    zona: profesional.timezone,
    pacientes,
    citas: citas ?? [],
    expedientes: expedientes.data ?? [],
    consultas: consultas.data ?? [],
    incluyeClinico: esDueño,
    hojas,
  })

  const base = filtroPaciente ? pacientes[0].name : profesional.name
  const sufijo = filtroPaciente
    ? 'expediente'
    : `pacientes-${new Date().toISOString().slice(0, 10)}`

  return { buffer, archivo: nombreArchivo(base, sufijo) }
}

export function respuestaExcel(buffer: Buffer, archivo: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      // Un expediente no se guarda en ninguna caché intermedia.
      'Cache-Control': 'no-store, private',
    },
  })
}
