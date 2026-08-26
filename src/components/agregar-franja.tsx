'use client'

import { useActionState, useState } from 'react'
import { agregarFranja, type Resultado } from '@/lib/admin/actions'

/**
 * Alta de una franja horaria. Empieza colapsada: en móvil, siete tarjetas con
 * dos campos de hora cada una vuelven la pantalla ilegible.
 */
export function AgregarFranja({ weekday, dia }: { weekday: number; dia: string }) {
  const [estado, formAction, pendiente] = useActionState<Resultado, FormData>(
    agregarFranja,
    {},
  )
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 text-sm font-semibold text-brand hover:underline"
      >
        + Agregar horario
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-4 border-t border-border pt-4">
      <input type="hidden" name="weekday" value={weekday} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`desde-${weekday}`} className="block text-xs font-medium text-muted">
            Desde
          </label>
          <input
            id={`desde-${weekday}`}
            type="time"
            name="start_time"
            defaultValue="09:00"
            required
            aria-label={`Hora de inicio para ${dia}`}
            className="campo mt-1 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`hasta-${weekday}`} className="block text-xs font-medium text-muted">
            Hasta
          </label>
          <input
            id={`hasta-${weekday}`}
            type="time"
            name="end_time"
            defaultValue="13:00"
            required
            aria-label={`Hora de fin para ${dia}`}
            className="campo mt-1 tabular-nums"
          />
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button disabled={pendiente} className="boton boton-primario flex-1 sm:flex-none">
          {pendiente ? 'Guardando…' : 'Agregar'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton boton-suave"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
