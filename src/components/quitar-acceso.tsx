'use client'

import { useState } from 'react'

/**
 * Quitar acceso es destructivo y va junto a un correo: un icono suelto se
 * confunde con "cerrar". Va con su nombre, y pide confirmación explicando la
 * consecuencia.
 */
export function QuitarAcceso({ email }: { email: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="boton boton-suave px-3 py-1.5 text-xs whitespace-nowrap"
      >
        Quitar acceso
      </button>
    )
  }

  return (
    <div className="text-right">
      <p className="mb-1.5 text-xs text-muted">
        {email} dejará de ver tu agenda de inmediato.
      </p>
      <div className="flex justify-end gap-2">
        <button className="boton px-3 py-1.5 text-xs border border-peligro text-peligro hover:bg-peligro-suave">
          Sí, quitar
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="boton boton-suave px-3 py-1.5 text-xs"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
