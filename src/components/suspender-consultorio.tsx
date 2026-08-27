'use client'

import { useActionState, useRef, useState } from 'react'
import {
  suspenderConsultorio,
  type ResultadoPlataforma,
} from '@/lib/plataforma/actions'
import { ConfirmarAccion } from '@/components/confirmar-accion'

/**
 * Suspender apaga el negocio de alguien más: su página pública deja de existir
 * y su agenda deja de recibir citas. Por eso pide motivo —que queda en la
 * bitácora— y no se hace de un clic.
 */
export function SuspenderConsultorio({
  id,
  nombre,
}: {
  id: string
  nombre: string
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoPlataforma, FormData>(
    suspenderConsultorio,
    {},
  )
  const [preguntando, setPreguntando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const formulario = useRef<HTMLFormElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setPreguntando(true)}
        className="boton border border-border px-3 py-1.5 text-xs text-peligro hover:border-peligro"
      >
        Suspender
      </button>

      {estado.error && (
        <p role="alert" className="basis-full text-xs text-peligro">
          {estado.error}
        </p>
      )}

      <form ref={formulario} action={formAction} className="contents">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="motivo" value={motivo} />
        <ConfirmarAccion
          abierto={preguntando}
          titulo={`¿Suspender a ${nombre}?`}
          detalle={
            <>
              <p>
                Su página pública deja de existir y su agenda deja de recibir citas.
                Los datos se quedan intactos y se puede reactivar cuando quieras.
              </p>
              <label htmlFor={`motivo-${id}`} className="mt-3 block text-xs text-muted">
                ¿Por qué? Queda en la bitácora.
              </label>
              <input
                id={`motivo-${id}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Falta de pago, cuenta de prueba, a petición del médico…"
                className="campo mt-1"
              />
            </>
          }
          confirmar="Suspender la cuenta"
          pendiente={pendiente}
          confirmarDeshabilitado={motivo.trim() === ''}
          onCancelar={() => setPreguntando(false)}
          onConfirmar={() => {
            setPreguntando(false)
            formulario.current?.requestSubmit()
          }}
        />
      </form>
    </>
  )
}
