import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { FormularioExpediente } from '@/components/formulario-expediente'
import type { ClinicalRecord, Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Expediente' }

export default async function ExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { esDueño } = await exigirConsultorio()
  // El asistente no tiene nada que hacer aquí, y la política lo respaldaría
  // igual si intentara guardar.
  if (!esDueño) redirect(`/admin/pacientes/${id}`)

  const supabase = await createClient()
  const [{ data: paciente }, { data: expediente }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).maybeSingle<Patient>(),
    supabase
      .from('clinical_records')
      .select('*')
      .eq('patient_id', id)
      .maybeSingle<ClinicalRecord>(),
  ])

  if (!paciente) notFound()

  return (
    <>
      <Link href={`/admin/pacientes/${id}`} className="text-sm text-acento hover:underline">
        ← {paciente.name}
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Expediente clínico</h1>
        <p className="mt-1 text-sm text-muted">
          Solo tú lo ves: tu asistente no tiene acceso a esta información.
        </p>
      </header>
      <FormularioExpediente pacienteId={id} expediente={expediente} />
    </>
  )
}
