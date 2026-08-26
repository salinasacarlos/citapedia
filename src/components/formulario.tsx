'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { Resultado } from '@/lib/admin/actions'

/** Envoltura para los formularios del admin: estado, error y aviso de éxito. */
export function Formulario({
  accion,
  enviar,
  children,
  className = '',
  onExito,
}: {
  accion: (estado: Resultado, datos: FormData) => Promise<Resultado>
  enviar: string
  children: React.ReactNode
  className?: string
  /** Se llama cuando la acción termina bien: sirve para limpiar el formulario. */
  onExito?: () => void
}) {
  const [estado, formAction, pendiente] = useActionState(accion, {})
  const ultimoOk = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (estado.ok && estado.ok !== ultimoOk.current) {
      ultimoOk.current = estado.ok
      onExito?.()
    }
  }, [estado.ok, onExito])

  return (
    <form action={formAction} className={className}>
      {children}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : enviar}
        </button>
        {estado.error && (
          <p role="alert" className="text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="text-sm text-exito">
            {estado.ok}
          </p>
        )}
      </div>
    </form>
  )
}

export function Campo({
  name,
  label,
  ayuda,
  children,
  ...props
}: {
  name: string
  label: string
  ayuda?: string
  children?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children ?? <input id={name} name={name} className="campo mt-1.5" {...props} />}
      {ayuda && <p className="mt-1 text-xs text-muted">{ayuda}</p>}
    </div>
  )
}
