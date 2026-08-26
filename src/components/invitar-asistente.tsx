'use client'

import { useActionState } from 'react'
import { invitarAsistente, type ResultadoEquipo } from '@/lib/equipo/actions'
import { LigaInvitacion } from '@/components/liga-invitacion'

export function InvitarAsistente() {
  const [estado, formAction, pendiente] = useActionState<ResultadoEquipo, FormData>(
    invitarAsistente,
    {},
  )

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Correo de tu asistente
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="asistente@ejemplo.com"
            className="campo mt-1.5"
          />
        </div>
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Creando…' : 'Invitar'}
        </button>
      </form>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      {estado.token && (
        <div className="mt-4">
          <LigaInvitacion token={estado.token} />
        </div>
      )}
    </div>
  )
}
