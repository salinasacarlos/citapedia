'use client'

import { useActionState } from 'react'
import { guardarExpediente, type ResultadoPaciente } from '@/lib/pacientes/actions'
import type { ClinicalRecord } from '@/lib/database.types'

const BLOQUES: {
  name: keyof ClinicalRecord
  label: string
  ayuda?: string
  filas?: number
}[] = [
  {
    name: 'allergies',
    label: 'Alergias',
    ayuda: 'Aparecen destacadas arriba de la ficha.',
    filas: 2,
  },
  { name: 'conditions', label: 'Padecimientos crónicos', filas: 2 },
  { name: 'medications', label: 'Medicamentos actuales', filas: 2 },
  { name: 'immunizations', label: 'Vacunas', ayuda: 'Cartilla, refuerzos, pendientes.', filas: 2 },
  { name: 'surgical_history', label: 'Cirugías y hospitalizaciones', filas: 2 },
  { name: 'family_history', label: 'Antecedentes familiares', filas: 2 },
  {
    name: 'habits',
    label: 'Hábitos',
    ayuda: 'Tabaco, alcohol, actividad física, alimentación.',
    filas: 2,
  },
  { name: 'notes', label: 'Notas generales', filas: 3 },
]

export function FormularioExpediente({
  pacienteId,
  expediente,
}: {
  pacienteId: string
  expediente: ClinicalRecord | null
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoPaciente, FormData>(
    guardarExpediente,
    {},
  )

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patient_id" value={pacienteId} />

      <section className="tarjeta p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="blood_type" className="block text-sm font-medium text-ink">
              Tipo de sangre
            </label>
            <input
              id="blood_type"
              name="blood_type"
              list="tipos-sangre"
              defaultValue={expediente?.blood_type ?? ''}
              className="campo mt-1.5"
            />
            <datalist id="tipos-sangre">
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {BLOQUES.map((bloque) => (
            <div key={bloque.name} className={bloque.filas && bloque.filas > 2 ? 'sm:col-span-2' : ''}>
              <label htmlFor={bloque.name} className="block text-sm font-medium text-ink">
                {bloque.label}
              </label>
              <textarea
                id={bloque.name}
                name={bloque.name}
                rows={bloque.filas ?? 2}
                defaultValue={(expediente?.[bloque.name] as string | null) ?? ''}
                className="campo mt-1.5 resize-y"
              />
              {bloque.ayuda && <p className="mt-1 text-xs text-muted">{bloque.ayuda}</p>}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : 'Guardar expediente'}
        </button>
        {estado.error && (
          <p role="alert" className="text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="text-sm text-exito">
            {estado.ok}
          </p>
        )}
      </div>
    </form>
  )
}
