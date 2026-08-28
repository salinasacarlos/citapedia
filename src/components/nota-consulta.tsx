'use client'

import { useActionState, useState } from 'react'
import { guardarConsulta, type ResultadoPaciente } from '@/lib/pacientes/actions'
import { ProximoControl } from '@/components/proximo-control'
import type { ConsultationNote } from '@/lib/database.types'

/**
 * Los rangos son los mismos que la base ya exige. Están aquí también porque
 * enterarse al guardar, después de haber capturado toda la consulta, es tarde:
 * el aviso tiene que llegar mientras el cursor sigue en el campo.
 */
const VITALES = [
  {
    name: 'weight_kg',
    label: 'Peso',
    unidad: 'kg',
    step: '0.1',
    min: 0.2,
    max: 500,
    // El error más común, y el más caro de descubrir al final: en pediatría el
    // peso del recién nacido se dice en gramos.
    pista: (v: number) =>
      v >= 500 && v <= 300000 ? `¿Son gramos? ${v} g son ${(v / 1000).toFixed(2)} kg.` : null,
  },
  { name: 'height_cm', label: 'Talla', unidad: 'cm', step: '0.1', min: 20, max: 300,
    pista: (v: number) => (v > 0 && v < 3 ? `¿Son metros? ${v} m son ${v * 100} cm.` : null) },
  { name: 'temperature_c', label: 'Temp.', unidad: '°C', step: '0.1', min: 25, max: 45 },
  { name: 'heart_rate', label: 'Pulso', unidad: 'lpm', step: '1', min: 20, max: 300 },
  { name: 'oxygen_saturation', label: 'Sat. O₂', unidad: '%', step: '1', min: 50, max: 100 },
] as const

type Vital = (typeof VITALES)[number]

type Aviso = { mensaje: string; bloquea: boolean }

/**
 * Qué decirle, y si hay que impedirle guardar.
 *
 * La pista de unidades reemplaza al mensaje de rango porque explica mejor lo
 * mismo, pero no lo ablanda: 3500 kg sigue siendo imposible y el guardado
 * sigue bloqueado. Un aviso que no impide guardar termina siendo un dato malo
 * en el expediente.
 */
function revisar(v: Vital, valor: string): Aviso | null {
  if (valor.trim() === '') return null
  const n = Number(valor.replace(',', '.'))
  if (!Number.isFinite(n)) return { mensaje: 'Escribe solo números.', bloquea: true }

  const pista = 'pista' in v ? v.pista(n) : null
  const fuera = n < v.min || n > v.max

  if (fuera) {
    return {
      mensaje: pista ?? `Fuera de rango: va de ${v.min} a ${v.max} ${v.unidad}.`,
      bloquea: true,
    }
  }
  // Dentro de rango pero sospechoso: se dice y se deja pasar.
  return pista ? { mensaje: pista, bloquea: false } : null
}

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
  yaTieneCita = false,
}: {
  citaId: string
  pacienteId: string
  nota: ConsultationNote | undefined
  onCerrar?: () => void
  /** Para no ofrecerle agendar a quien ya tiene cita hacia adelante. */
  yaTieneCita?: boolean
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoPaciente, FormData>(
    guardarConsulta,
    {},
  )
  const [avisos, setAvisos] = useState<Record<string, Aviso | null>>({})
  const hayImposibles = Object.values(avisos).some((a) => a?.bloquea)

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
              onChange={(e) =>
                setAvisos((a) => ({ ...a, [v.name]: revisar(v, e.target.value) }))
              }
              aria-invalid={Boolean(avisos[v.name])}
              className={`campo mt-1 tabular-nums ${
                avisos[v.name]?.bloquea
                  ? 'border-peligro'
                  : avisos[v.name]
                    ? 'border-alerta'
                    : ''
              }`}
            />
            {avisos[v.name] && (
              <p
                role="alert"
                className={`mt-1 text-xs ${
                  avisos[v.name]?.bloquea ? 'text-peligro' : 'text-alerta'
                }`}
              >
                {avisos[v.name]?.mensaje}
              </p>
            )}
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

      <ProximoControl
        citaId={citaId}
        pacienteId={pacienteId}
        yaTieneCita={yaTieneCita}
        valorInicial={nota?.follow_up_at ?? null}
        motivoInicial={nota?.follow_up_reason ?? null}
      />

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
        <button
          disabled={pendiente || hayImposibles}
          className="boton boton-primario px-3 py-1.5 text-xs"
        >
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
