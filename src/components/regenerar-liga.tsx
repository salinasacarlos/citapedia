'use client'

import { useActionState } from 'react'
import { regenerarInvitacion, type ResultadoEquipo } from '@/lib/equipo/actions'

/** Para cuando la liga venció o se compartió por el canal equivocado. */
export function RegenerarLiga({ id, email }: { id: string; email: string }) {
  const [estado, formAction, pendiente] = useActionState<ResultadoEquipo, FormData>(
    regenerarInvitacion,
    {},
  )

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="email" value={email} />
      <button
        disabled={pendiente}
        className="text-xs font-medium text-acento hover:underline disabled:opacity-50"
      >
        {pendiente ? 'Generando…' : 'Generar liga nueva'}
      </button>
      {estado.error && <span className="text-xs text-peligro">{estado.error}</span>}
      {estado.avisoEnvio && (
        <span className="text-xs text-alerta">{estado.avisoEnvio}</span>
      )}
      {estado.ok && !estado.avisoEnvio && (
        <span className="text-xs text-exito">Enviada por correo</span>
      )}
    </form>
  )
}
