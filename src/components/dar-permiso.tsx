'use client'

import { useActionState } from 'react'
import { darPermiso, type ResultadoPermiso } from '@/lib/plataforma/permisos'

/**
 * Reparte permiso sobre una cuenta que YA existe. Crear la cuenta es otra
 * cosa y vive en otro lado: así el permiso queda anotado aunque la cuenta se
 * haya creado desde el panel de Supabase.
 */
export function DarPermiso() {
  const [estado, formAction, pendiente] = useActionState<ResultadoPermiso, FormData>(
    darPermiso,
    {},
  )

  return (
    <div className="tarjeta p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Dar acceso a alguien</h2>
      <p className="mt-1 text-sm text-muted">
        La cuenta tiene que existir ya. Si es gente nueva, créala primero en Supabase
        y luego dale permiso aquí.
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="email-permiso" className="block text-xs font-medium text-muted">
            Correo de la cuenta
          </label>
          <input
            id="email-permiso"
            name="email"
            type="email"
            required
            placeholder="alguien@ejemplo.com"
            className="campo mt-1"
          />
        </div>
        <div className="sm:w-40">
          <label htmlFor="rol-permiso" className="block text-xs font-medium text-muted">
            Puede
          </label>
          <select id="rol-permiso" name="rol" defaultValue="soporte" className="campo mt-1">
            <option value="soporte">Solo ver</option>
            <option value="fundador">Ver y operar</option>
          </select>
        </div>
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : 'Dar acceso'}
        </button>
      </form>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="mt-3 text-sm text-exito">
          {estado.ok}
        </p>
      )}
    </div>
  )
}
