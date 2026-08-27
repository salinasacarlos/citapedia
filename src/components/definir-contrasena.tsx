'use client'

import { useActionState } from 'react'
import { definirContrasena, type ResultadoDefinir } from '@/lib/auth/definir'

export function DefinirContrasena() {
  const [estado, formAction, pendiente] = useActionState<ResultadoDefinir, FormData>(
    definirContrasena,
    {},
  )

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Tu contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="campo mt-1.5"
        />
        <p className="mt-1 text-xs text-muted">Al menos 8 caracteres.</p>
      </div>

      <div>
        <label htmlFor="password2" className="block text-sm font-medium text-ink">
          Otra vez, para estar seguros
        </label>
        <input
          id="password2"
          name="password2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="campo mt-1.5"
        />
      </div>

      {estado.error && (
        <p role="alert" className="text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <button disabled={pendiente} className="boton boton-primario w-full">
        {pendiente ? 'Guardando…' : 'Entrar a mi consultorio'}
      </button>
    </form>
  )
}
