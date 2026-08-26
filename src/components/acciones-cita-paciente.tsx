'use client'

import { useActionState, useState } from 'react'
import { cancelarComoPaciente, confirmarAsistencia, type ResultadoCita } from '@/lib/publico/cita'

export function AccionesCitaPaciente({
  token,
  yaConfirmo,
}: {
  token: string
  yaConfirmo: boolean
}) {
  const [confirmar, accionConfirmar, confirmando] = useActionState<ResultadoCita, FormData>(
    confirmarAsistencia,
    {},
  )
  const [cancelar, accionCancelar, cancelando] = useActionState<ResultadoCita, FormData>(
    cancelarComoPaciente,
    {},
  )
  // Cancelar una cita médica no puede ser un clic distraído.
  const [seguro, setSeguro] = useState(false)

  const confirmado = yaConfirmo || Boolean(confirmar.ok)

  return (
    <div className="mt-6">
      {confirmado ? (
        <p className="rounded-marca bg-exito-suave px-4 py-3 text-center text-sm font-medium text-exito">
          Ya confirmaste que vas a asistir. Te esperamos.
        </p>
      ) : (
        <form action={accionConfirmar}>
          <input type="hidden" name="token" value={token} />
          <button disabled={confirmando} className="boton boton-primario w-full py-3">
            {confirmando ? 'Confirmando…' : 'Sí, ahí estaré'}
          </button>
          {confirmar.error && (
            <p role="alert" className="mt-2 text-sm text-peligro">
              {confirmar.error}
            </p>
          )}
        </form>
      )}

      {!seguro ? (
        <button
          type="button"
          onClick={() => setSeguro(true)}
          className="mt-3 w-full text-sm text-muted hover:text-peligro hover:underline"
        >
          No voy a poder asistir
        </button>
      ) : (
        <form action={accionCancelar} className="mt-4 rounded-marca border border-peligro/30 bg-peligro-suave/40 p-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-foreground">
            Si cancelas, el horario queda libre para alguien más y tendrás que
            volver a agendar.
          </p>
          {cancelar.error && (
            <p role="alert" className="mt-2 text-sm text-peligro">
              {cancelar.error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={cancelando}
              className="boton border border-peligro px-4 py-2 text-sm text-peligro hover:bg-peligro-suave"
            >
              {cancelando ? 'Cancelando…' : 'Sí, cancelar mi cita'}
            </button>
            <button
              type="button"
              onClick={() => setSeguro(false)}
              className="boton boton-suave"
            >
              Mejor no
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
