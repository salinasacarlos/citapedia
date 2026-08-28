'use client'

import { useActionState } from 'react'
import { definirContrasena, type ResultadoDefinir } from '@/lib/auth/definir'
import { CampoContrasena } from '@/components/campo-contrasena'

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
        <div className="mt-1.5">
          <CampoContrasena name="password" minLength={8} autoComplete="new-password" />
        </div>
        <p className="mt-1 text-xs text-muted">Al menos 8 caracteres.</p>
      </div>

      <div>
        <label htmlFor="password2" className="block text-sm font-medium text-ink">
          Otra vez, para estar seguros
        </label>
        <div className="mt-1.5">
          <CampoContrasena name="password2" minLength={8} autoComplete="new-password" />
        </div>
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
