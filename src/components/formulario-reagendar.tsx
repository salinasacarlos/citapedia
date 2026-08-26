'use client'

import { useActionState, useState } from 'react'
import { reagendarCita, type ResultadoReagendar } from '@/lib/admin/reagendar'
import { SelectorHueco, etiquetaDia, etiquetaHora } from '@/components/selector-hueco'
import type { DiaConHuecos } from '@/lib/slots'

export function FormularioReagendar({
  citaId,
  zona,
  dias,
}: {
  citaId: string
  zona: string
  dias: DiaConHuecos[]
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoReagendar, FormData>(
    reagendarCita,
    {},
  )
  const [elegido, setElegido] = useState<{ inicio: string; fecha: string } | null>(null)

  if (!elegido) {
    return (
      <SelectorHueco
        dias={dias}
        zona={zona}
        onElegir={(inicio, fecha) => setElegido({ inicio, fecha })}
      />
    )
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="cita" value={citaId} />
      <input type="hidden" name="inicio" value={elegido.inicio} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-brand/30 bg-brand-suave px-4 py-3">
        <div>
          <p className="text-xs font-medium text-brand">Horario nuevo</p>
          <p className="font-semibold text-ink first-letter:uppercase">
            {etiquetaDia(elegido.fecha)} a las {etiquetaHora(elegido.inicio, zona)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setElegido(null)}
          className="text-sm font-medium text-acento hover:underline"
        >
          Cambiar
        </button>
      </div>

      {estado.error && (
        <p role="alert" className="mt-4 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <button disabled={pendiente} className="boton boton-primario mt-4 w-full py-3 sm:w-auto sm:px-6">
        {pendiente ? 'Moviendo…' : 'Confirmar el cambio'}
      </button>
    </form>
  )
}
