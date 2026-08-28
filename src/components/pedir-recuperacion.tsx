'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { pedirRecuperacion, type ResultadoRecuperar } from '@/lib/auth/recuperar'

export function PedirRecuperacion() {
  const [estado, formAction, pendiente] = useActionState<ResultadoRecuperar, FormData>(
    pedirRecuperacion,
    {},
  )

  // El mismo mensaje exista o no la cuenta: decir "ese correo no está" le diría
  // a cualquiera qué médicos usan CitaPedia.
  if (estado.listo) {
    return (
      <div className="mt-6 rounded-marca border border-brand/30 bg-brand-suave p-4">
        <p className="text-sm font-semibold text-ink">Revisa tu correo</p>
        <p className="mt-1 text-sm text-muted">
          Si hay una cuenta con esa dirección, ya va en camino una liga para elegir
          contraseña nueva. Vence en una hora y sirve una sola vez.
        </p>
        <p className="mt-2 text-xs text-muted">
          ¿No llega? Mira en spam, y revisa que sea el correo con el que entras.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Tu correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="campo mt-1.5"
        />
      </div>

      {estado.error && (
        <p role="alert" className="text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <button disabled={pendiente} className="boton boton-primario w-full">
        {pendiente ? 'Mandando…' : 'Mandarme la liga'}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-acento hover:underline">
          Volver a entrar
        </Link>
      </p>
    </form>
  )
}
