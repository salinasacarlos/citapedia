import Link from 'next/link'
import { exigirConsultorio } from '@/lib/consultorio'
import { FormularioPaciente } from '@/components/formulario-paciente'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nuevo paciente' }

export default async function NuevoPacientePage() {
  await exigirConsultorio()

  return (
    <>
      <Link href="/admin/pacientes" className="text-sm text-acento hover:underline">
        ← Pacientes
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Nuevo paciente</h1>
        <p className="mt-1 text-sm text-muted">
          Para quien llega sin haber agendado por internet.
        </p>
      </header>
      <FormularioPaciente />
    </>
  )
}
