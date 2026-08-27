'use client'

import { useActionState, useRef, useState } from 'react'
import { cancelarCita, type Resultado } from '@/lib/admin/actions'
import { ConfirmarAccion } from '@/components/confirmar-accion'

/**
 * Cancelar avisa antes de hacerlo. No es como quitar una franja del horario:
 * del otro lado hay una persona que ya apartó ese día, y muchas veces ya
 * confirmó que va a venir.
 */
export function CancelarCita({
  id,
  paciente,
  cuando,
  confirmadaPorPaciente,
}: {
  id: string
  paciente: string
  cuando: string
  confirmadaPorPaciente: boolean
}) {
  const [estado, formAction, pendiente] = useActionState<Resultado, FormData>(
    cancelarCita,
    {},
  )
  const [preguntando, setPreguntando] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setPreguntando(true)}
        className="boton border border-border px-3 py-1.5 text-xs text-peligro hover:border-peligro"
      >
        Cancelar
      </button>

      {estado.error && (
        <p role="alert" className="basis-full text-xs text-peligro">
          {estado.error}
        </p>
      )}

      <form ref={formulario} action={formAction} className="contents">
        <input type="hidden" name="id" value={id} />
        <ConfirmarAccion
          abierto={preguntando}
          titulo="¿Cancelar esta cita?"
          detalle={
            <>
              <p>
                <strong className="text-ink">{paciente}</strong> tenía apartado{' '}
                {/* `cuando` ya termina en "p.m." — otro punto lo duplica. */}
                <span className="whitespace-nowrap">{cuando}</span>
              </p>
              <p className="mt-2">
                El horario vuelve a quedar libre para quien lo pida.{' '}
                {confirmadaPorPaciente
                  ? 'Ya te había confirmado que venía, así que conviene avisarle tú.'
                  : 'Al paciente no le llega ningún aviso: avísale tú.'}
              </p>
            </>
          }
          confirmar="Sí, cancelar la cita"
          pendiente={pendiente}
          onCancelar={() => setPreguntando(false)}
          onConfirmar={() => {
            // Se cierra al confirmar, no cuando responde el servidor: esperar
            // con el diálogo encima parece que no pasó nada. Si algo falla, el
            // error sale en la fila.
            setPreguntando(false)
            formulario.current?.requestSubmit()
          }}
        />
      </form>
    </>
  )
}
