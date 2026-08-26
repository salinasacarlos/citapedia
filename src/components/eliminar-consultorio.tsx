'use client'

import { useActionState, useState } from 'react'
import { eliminarConsultorio, type ResultadoCuenta } from '@/lib/cuenta/actions'

export function EliminarConsultorio({ slug }: { slug: string }) {
  const [estado, formAction, pendiente] = useActionState<ResultadoCuenta, FormData>(
    eliminarConsultorio,
    {},
  )
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton border border-peligro px-4 py-2 text-sm text-peligro hover:bg-peligro-suave"
      >
        Eliminar mi consultorio
      </button>
    )
  }

  return (
    <form action={formAction}>
      <label htmlFor="confirmacion" className="block text-sm font-medium text-ink">
        Para confirmar, escribe{' '}
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em]">{slug}</code>
      </label>
      <input
        id="confirmacion"
        name="confirmacion"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoComplete="off"
        className="campo mt-1.5 max-w-sm"
      />

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={pendiente || texto !== slug}
          className="boton border border-peligro px-4 py-2 text-sm text-peligro hover:bg-peligro-suave disabled:opacity-40"
        >
          {pendiente ? 'Eliminando…' : 'Eliminar para siempre'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setTexto('')
          }}
          className="boton boton-suave"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
