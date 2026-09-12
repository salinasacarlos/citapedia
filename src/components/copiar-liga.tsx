'use client'

import { useState } from 'react'

/**
 * La liga de la cita vivía solo dentro del mensaje de WhatsApp. Sirve mientras
 * el paciente tenga teléfono capturado y quiera WhatsApp; en el mostrador
 * también se dicta, se manda por correo o se pega en otro chat. Copiarla tiene
 * que ser posible sin pasar por el botón de WhatsApp.
 */
export function CopiarLiga({
  liga,
  etiqueta = 'Copiar liga',
  compacto = false,
}: {
  liga: string
  etiqueta?: string
  /** Para cuando va pegado a un texto y no como acción principal. */
  compacto?: boolean
}) {
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
      className={
        compacto
          ? 'rounded px-1.5 py-0.5 text-xs font-medium text-acento transition hover:bg-surface-2'
          : 'boton boton-suave px-3 py-1.5 text-xs'
      }
      title={liga}
    >
      {copiada ? 'Copiada ✓' : etiqueta}
    </button>
  )
}
