'use client'

import { useActionState, useState } from 'react'
import { reagendarComoPaciente, type ResultadoCita } from '@/lib/publico/cita'
import { SelectorHueco, etiquetaDia, etiquetaHora } from '@/components/selector-hueco'
import type { DiaConHuecos } from '@/lib/slots'

export function ReagendarPaciente({
  token,
  zona,
  dias,
}: {
  token: string
  zona: string
  dias: DiaConHuecos[]
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoCita, FormData>(
    reagendarComoPaciente,
    {},
  )
  const [abierto, setAbierto] = useState(false)
  const [elegido, setElegido] = useState<{ inicio: string; fecha: string } | null>(null)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 w-full text-sm font-semibold text-acento hover:underline"
      >
        Necesito otro día u hora
      </button>
    )
  }

  if (dias.length === 0) {
    return (
      <div className="mt-4 rounded-marca border border-border bg-surface-2 p-4 text-center">
        <p className="text-sm text-muted">
          No hay otros horarios libres en las próximas semanas. Habla al
          consultorio para moverla.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton boton-suave mt-3"
        >
          Volver
        </button>
      </div>
    )
  }

  if (!elegido) {
    return (
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Elige otro horario</p>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="text-sm text-muted hover:underline"
          >
            Cancelar
          </button>
        </div>
        <SelectorHueco
          dias={dias}
          zona={zona}
          onElegir={(inicio, fecha) => setElegido({ inicio, fecha })}
        />
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="inicio" value={elegido.inicio} />

      <div className="rounded-marca border border-acento/30 bg-acento-suave px-4 py-3">
        <p className="text-xs font-medium text-acento">Tu cita quedaría</p>
        <p className="font-semibold text-ink first-letter:uppercase">
          {etiquetaDia(elegido.fecha)} a las {etiquetaHora(elegido.inicio, zona)}
        </p>
      </div>

      {estado.error && (
        <p role="alert" className="mt-3 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pendiente} className="boton boton-primario flex-1">
          {pendiente ? 'Moviendo…' : 'Mover mi cita aquí'}
        </button>
        <button
          type="button"
          onClick={() => setElegido(null)}
          className="boton boton-suave"
        >
          Otro horario
        </button>
      </div>
    </form>
  )
}
