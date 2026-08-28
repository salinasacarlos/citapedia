'use client'

import { useActionState, useRef, useEffect } from 'react'
import { cambiarContrasena, type ResultadoCuenta } from '@/lib/cuenta/actions'
import { CampoContrasena } from '@/components/campo-contrasena'

export function CambiarContrasena() {
  const [estado, formAction, pendiente] = useActionState<ResultadoCuenta, FormData>(
    cambiarContrasena,
    {},
  )
  const form = useRef<HTMLFormElement>(null)

  // Al lograrlo, no dejamos las contraseñas escritas en pantalla.
  useEffect(() => {
    if (estado.ok) form.current?.reset()
  }, [estado.ok])

  const campos = [
    { name: 'actual', label: 'Contraseña de ahora', autoComplete: 'current-password' },
    { name: 'nueva', label: 'Contraseña nueva', autoComplete: 'new-password' },
    { name: 'repetida', label: 'Repite la nueva', autoComplete: 'new-password' },
  ]

  return (
    <form ref={form} action={formAction}>
      <div className="grid gap-4 sm:grid-cols-3">
        {campos.map((campo) => (
          <div key={campo.name}>
            <label htmlFor={campo.name} className="block text-sm font-medium text-ink">
              {campo.label}
            </label>
            <div className="mt-1.5">
              <CampoContrasena
                name={campo.name}
                minLength={campo.name === 'actual' ? undefined : 8}
                autoComplete={campo.autoComplete}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
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
