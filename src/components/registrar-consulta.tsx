'use client'

import { useState } from 'react'
import { registrarConsulta } from '@/lib/pacientes/actions'

/**
 * Para el paciente que llegó sin cita.
 *
 * Toda nota clínica cuelga de una cita, así que sin esto habría que ir a la
 * agenda, inventar una cita y volver. La fecha se puede mover porque a veces
 * se captura una consulta de ayer, pero por defecto es ahora: el caso normal
 * es el paciente que está enfrente.
 */
export function RegistrarConsulta({ pacienteId }: { pacienteId: string }) {
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton boton-suave px-3 py-1.5 text-xs"
      >
        Registrar una consulta
      </button>
    )
  }

  return (
    <form
      action={registrarConsulta}
      className="tarjeta flex flex-wrap items-end gap-3 p-4"
    >
      <input type="hidden" name="patient_id" value={pacienteId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="cuando" className="block text-xs font-medium text-muted">
          ¿Cuándo fue? <span className="opacity-70">vacío = ahora</span>
        </label>
        <input
          id="cuando"
          name="cuando"
          type="datetime-local"
          className="campo mt-1 w-full"
        />
      </div>
      <button className="boton boton-primario px-3 py-1.5 text-xs">
        Abrir la consulta
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="boton boton-suave px-3 py-1.5 text-xs"
      >
        Cancelar
      </button>
    </form>
  )
}
