'use client'

import { useActionState } from 'react'
import type { Resultado } from '@/lib/admin/actions'

type Accion = (estado: Resultado, datos: FormData) => Promise<Resultado>

export type AccionCita = {
  accion: Accion
  etiqueta: string
  tono?: 'primario' | 'suave' | 'peligro'
}

function Boton({ id, accion, etiqueta, tono = 'suave' }: AccionCita & { id: string }) {
  const [estado, formAction, pendiente] = useActionState(accion, {})

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pendiente}
        className={`boton px-3 py-1.5 text-xs ${
          tono === 'primario'
            ? 'boton-primario'
            : tono === 'peligro'
              ? 'border border-border text-peligro hover:border-peligro'
              : 'boton-suave'
        }`}
      >
        {pendiente ? '…' : etiqueta}
      </button>
      {/* El error se muestra junto al botón que lo produjo: casi siempre es
          específico de esa cita, como un choque de horario. */}
      {estado.error && (
        <p role="alert" className="basis-full text-xs text-peligro">
          {estado.error}
        </p>
      )}
    </form>
  )
}

export function AccionesCita({ id, acciones }: { id: string; acciones: AccionCita[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {acciones.map((a) => (
        <Boton key={a.etiqueta} id={id} {...a} />
      ))}
    </div>
  )
}
