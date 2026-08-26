'use client'

import { useState } from 'react'

/**
 * La liga de la cita vivía solo dentro del mensaje de WhatsApp. Sirve mientras
 * el paciente tenga teléfono capturado y quiera WhatsApp; en el mostrador
 * también se dicta, se manda por correo o se pega en otro chat. Copiarla tiene
 * que ser posible sin pasar por el botón de WhatsApp.
 */
export function CopiarLiga({ liga }: { liga: string }) {
  const [copiada, setCopiada] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(liga)
          setCopiada(true)
          setTimeout(() => setCopiada(false), 2500)
        } catch {
          // Sin permiso de portapapeles, la liga se muestra para copiarla a mano.
          window.prompt('Copia la liga de la cita:', liga)
        }
      }}
      className="boton boton-suave px-3 py-1.5 text-xs"
      title={liga}
    >
      {copiada ? 'Liga copiada ✓' : 'Copiar liga'}
    </button>
  )
}
