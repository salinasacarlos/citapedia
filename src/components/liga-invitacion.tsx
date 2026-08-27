'use client'

import { useState } from 'react'

/**
 * La liga ES la credencial. Mientras no haya correo saliendo del sistema, el
 * médico la comparte a mano, así que copiarla tiene que ser de un toque.
 */
export function LigaInvitacion({
  token,
  email,
  enviada = false,
}: {
  token: string
  email?: string
  /** Ya salió por correo: la liga queda como respaldo, no como el único camino. */
  enviada?: boolean
}) {
  const [copiada, setCopiada] = useState(false)
  const liga = `${typeof window === 'undefined' ? '' : window.location.origin}/invitacion/${token}`

  return (
    <div className="rounded-marca border border-brand/30 bg-brand-suave p-4">
      <p className="text-sm font-semibold text-ink">
        Comparte esta liga{email ? ` con ${email}` : ''}
      </p>
      <p className="mt-1 text-xs text-muted">
        Con ella crea su cuenta y elige su propia contraseña — tú nunca la ves.
        Vence en 7 días y solo sirve para ese correo.
      </p>
      <p className="mt-1 text-xs text-muted">
        {enviada
          ? 'Ya se la mandamos por correo. Esta copia es por si no le llega.'
          : 'Pásasela tú por WhatsApp o mensaje.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          readOnly
          value={liga}
          onFocus={(e) => e.currentTarget.select()}
          className="campo min-w-0 flex-1 font-mono text-xs"
          aria-label="Liga de invitación"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(liga)
              setCopiada(true)
              setTimeout(() => setCopiada(false), 2500)
            } catch {
              // Sin permiso de portapapeles queda seleccionable a mano.
            }
          }}
          className="boton boton-primario"
        >
          {copiada ? 'Copiada ✓' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
