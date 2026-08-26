'use client'

import { useActionState, useState } from 'react'
import { guardarConsulta, type ResultadoPaciente } from '@/lib/pacientes/actions'
import type { ConsultationNote } from '@/lib/database.types'

const VITALES = [
  { name: 'weight_kg', label: 'Peso', unidad: 'kg', step: '0.1' },
  { name: 'height_cm', label: 'Talla', unidad: 'cm', step: '0.1' },
  { name: 'temperature_c', label: 'Temp.', unidad: '°C', step: '0.1' },
  { name: 'heart_rate', label: 'Pulso', unidad: 'lpm', step: '1' },
  { name: 'oxygen_saturation', label: 'Sat. O₂', unidad: '%', step: '1' },
] as const

/**
 * El mismo formulario en dos lugares: plegado dentro de la bitácora, y abierto
 * de par en par en el workspace de la consulta. Se extrae para que no haya dos
 * versiones de los campos clínicos que se puedan ir separando.
 */
export function FormularioConsulta({
  citaId,
  pacienteId,
  nota,
  onCerrar,
}: {
  citaId: string
  pacienteId: string
  nota: ConsultationNote | undefined
  onCerrar?: () => void
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoPaciente, FormData>(
    guardarConsulta,
    {},
  )

  return (
    <form action={formAction} className="rounded-marca border border-border p-3">
      <input type="hidden" name="appointment_id" value={citaId} />
      <input type="hidden" name="patient_id" value={pacienteId} />

      <p className="mb-2 text-xs font-medium text-muted">Signos vitales</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {VITALES.map((v) => (
          <div key={v.name}>
            <label htmlFor={`${v.name}-${citaId}`} className="block text-xs text-muted">
              {v.label} <span className="opacity-60">{v.unidad}</span>
            </label>
            <input
              id={`${v.name}-${citaId}`}
              name={v.name}
              type="number"
              step={v.step}
              inputMode="decimal"
              defaultValue={(nota?.[v.name] as number | null) ?? ''}
              className="campo mt-1 tabular-nums"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`pa-${citaId}`} className="block text-xs text-muted">
            Presión arterial
          </label>
          <input
            id={`pa-${citaId}`}
            name="blood_pressure"
            placeholder="120/80"
            defaultValue={nota?.blood_pressure ?? ''}
            className="campo mt-1 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`dx-${citaId}`} className="block text-xs text-muted">
            Diagnóstico
          </label>
          <input
            id={`dx-${citaId}`}
            name="diagnosis"
            defaultValue={nota?.diagnosis ?? ''}
            className="campo mt-1"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor={`tx-${citaId}`} className="block text-xs text-muted">
            Tratamiento indicado
          </label>
          <textarea
            id={`tx-${citaId}`}
            name="treatment"
            rows={2}
            defaultValue={nota?.treatment ?? ''}
            className="campo mt-1 resize-y"
          />
        </div>
        <div>
          <label htmlFor={`nota-${citaId}`} className="block text-xs text-muted">
            Nota de la consulta
          </label>
          <textarea
            id={`nota-${citaId}`}
            name="note"
            rows={3}
            defaultValue={nota?.note ?? ''}
            placeholder="Hallazgos, evolución, indicaciones."
            className="campo mt-1 resize-y"
          />
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="mt-3 text-sm text-exito">
          {estado.ok}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button disabled={pendiente} className="boton boton-primario px-3 py-1.5 text-xs">
          {pendiente ? 'Guardando…' : 'Guardar nota'}
        </button>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="boton boton-suave px-3 py-1.5 text-xs"
          >
            Cerrar
          </button>
        )}
      </div>
    </form>
  )
}

export function NotaConsulta({
  citaId,
  pacienteId,
  nota,
}: {
  citaId: string
  pacienteId: string
  nota: ConsultationNote | undefined
}) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 text-sm font-semibold text-brand hover:underline"
      >
        {nota ? 'Editar nota de consulta' : '+ Agregar nota de consulta'}
      </button>
    )
  }

  return (
    <div className="mt-3">
      <FormularioConsulta
        citaId={citaId}
        pacienteId={pacienteId}
        nota={nota}
        onCerrar={() => setAbierto(false)}
      />
    </div>
  )
}
