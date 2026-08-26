'use client'

import { useState } from 'react'

/**
 * Borrar de un clic, pegado al contenido, es demasiado fácil de hacer sin
 * querer. Pide confirmación sin sacar un diálogo encima.
 */
export function BotonQuitar({ etiqueta }: { etiqueta: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Quitar ${etiqueta}`}
        className="text-muted transition hover:text-peligro"
      >
        ✕
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <button className="text-xs font-semibold text-peligro hover:underline">Quitar</button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs text-muted hover:underline"
      >
        No
      </button>
    </span>
  )
}
