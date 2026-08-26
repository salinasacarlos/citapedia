'use client'

import { useActionState } from 'react'
import { aceptarInvitacion, type ResultadoEquipo } from '@/lib/equipo/actions'

export function AceptarInvitacion({ token }: { token: string }) {
  const [estado, formAction, pendiente] = useActionState<ResultadoEquipo, FormData>(
    aceptarInvitacion,
    {},
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <button disabled={pendiente} className="boton boton-primario w-full py-3">
        {pendiente ? 'Entrando…' : 'Aceptar invitación'}
      </button>
      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}
    </form>
  )
}
