'use client'

import { useActionState, useState } from 'react'
import { declararDatosMedicos, type EstadoDeclaracion } from '@/lib/publico/actions'

const CAMPOS = [
  {
    name: 'alergias',
    label: 'Alergias',
    ayuda: 'Medicamentos, alimentos, picaduras. Si no sabes de ninguna, déjalo vacío.',
  },
  { name: 'padecimientos', label: 'Padecimientos', ayuda: 'Asma, diabetes, hipertensión…' },
  { name: 'medicamentos', label: 'Medicamentos que toma ahora' },
]

export function DeclararDatos({ citaId, medico }: { citaId: string; medico: string }) {
  const [estado, formAction, pendiente] = useActionState<EstadoDeclaracion, FormData>(
    declararDatosMedicos,
    {},
  )
  const [abierto, setAbierto] = useState(false)

  if (estado.ok) {
    return (
      <div className="tarjeta mt-4 p-5 text-center">
        <p className="font-semibold text-ink">Gracias, ya quedaron tus datos</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {medico} los va a revisar contigo en la consulta.
        </p>
      </div>
    )
  }

  if (!abierto) {
    return (
      <div className="tarjeta mt-4 p-5 text-center">
        <p className="font-semibold text-ink">¿Nos adelantas tus datos médicos?</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Es opcional, toma un minuto y le ahorra tiempo a tu consulta. Solo lo
          que tengas a la mano.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="boton boton-primario mt-4"
        >
          Adelantar mis datos
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="tarjeta mt-4 p-4 text-left sm:p-6">
      <input type="hidden" name="cita" value={citaId} />

      <h2 className="font-bold text-ink">Tus datos médicos</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Todo es opcional. Lo que no sepas, déjalo vacío: {medico} lo completa en
        la consulta.
      </p>

      <div className="grid gap-4">
        {CAMPOS.map((campo) => (
          <div key={campo.name}>
            <label htmlFor={campo.name} className="block text-sm font-medium text-ink">
              {campo.label}
            </label>
            <textarea
              id={campo.name}
              name={campo.name}
              rows={2}
              className="campo mt-1.5 resize-y"
            />
            {campo.ayuda && <p className="mt-1 text-xs text-muted">{campo.ayuda}</p>}
          </div>
        ))}

        <div>
          <label htmlFor="tipo_sangre" className="block text-sm font-medium text-ink">
            Tipo de sangre <span className="font-normal text-muted">(si lo sabes)</span>
          </label>
          <input
            id="tipo_sangre"
            name="tipo_sangre"
            list="tipos-sangre-publico"
            className="campo mt-1.5 max-w-32"
          />
          <datalist id="tipos-sangre-publico">
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Los datos de salud son sensibles: el permiso se pide explícito, no en
          letra chica. */}
      <label className="mt-5 flex items-start gap-2.5 rounded-lg bg-surface-2 p-3 text-sm">
        <input
          type="checkbox"
          name="consentimiento"
          required
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand-vivo)]"
        />
        <span className="text-muted">
          Autorizo a {medico} a guardar estos datos de salud para mi atención
          médica. Puedo pedir que los borren cuando quiera.
        </span>
      </label>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : 'Guardar mis datos'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton boton-suave"
        >
          Ahora no
        </button>
      </div>
    </form>
  )
}
