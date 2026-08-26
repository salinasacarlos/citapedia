import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { FormularioPaciente } from '@/components/formulario-paciente'
import type { Patient } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Editar paciente' }

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await exigirConsultorio()
  const supabase = await createClient()

  const { data: paciente } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle<Patient>()

  if (!paciente) notFound()

  return (
    <>
      <Link href={`/admin/pacientes/${id}`} className="text-sm text-acento hover:underline">
        ← {paciente.name}
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Editar datos</h1>
        <p className="mt-1 text-sm text-muted">
          Contacto y datos administrativos. El expediente clínico se edita aparte.
        </p>
      </header>
      <FormularioPaciente paciente={paciente} />
    </>
  )
}
