'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Marca } from '@/components/marca'
import { CampoContrasena } from '@/components/campo-contrasena'
import type { EstadoFormulario } from '@/lib/auth/actions'

type Campo = {
  name: string
  label: string
  type?: string
  required?: boolean
  autoComplete?: string
  placeholder?: string
  ayuda?: string
  valorInicial?: string
  /** El correo de una invitación no se puede cambiar: la ata. */
  fijo?: boolean
  /** Catálogo sugerido, sin cerrar el campo: se puede escribir otra cosa. */
  sugerencias?: readonly string[]
}

export function FormularioAuth({
  accion,
  titulo,
  descripcion,
  campos,
  cta,
  pie,
  ocultos,
  distintivo,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>
  titulo: string
  descripcion: string
  campos: Campo[]
  cta: string
  /** No todas las puertas ofrecen crear cuenta: la de plataforma no. */
  pie?: { texto: string; enlace: string; href: string }
  /** Campos que viajan con el formulario sin que el usuario los vea. */
  ocultos?: Record<string, string>
  /** Para que se note de entrada a qué puerta llegaste. */
  distintivo?: string
}) {
  const [estado, formAction, pendiente] = useActionState(accion, {})

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Marca href="/" />
      {distintivo && (
        <span className="mt-6 w-fit rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-surface">
          {distintivo}
        </span>
      )}
      <h1
        className={`text-2xl font-bold tracking-tight text-ink ${distintivo ? 'mt-3' : 'mt-6'}`}
      >
        {titulo}
      </h1>
      <p className="mt-2 text-sm text-muted">{descripcion}</p>

      <form action={formAction} className="mt-8 space-y-4">
        {Object.entries(ocultos ?? {}).map(([nombre, valor]) => (
          <input key={nombre} type="hidden" name={nombre} value={valor} />
        ))}
        {campos.map((campo) => (
          <div key={campo.name}>
            <label htmlFor={campo.name} className="block text-sm font-medium text-ink">
              {campo.label}
            </label>
            {campo.type === 'password' ? (
              <div className="mt-1.5">
                <CampoContrasena
                  name={campo.name}
                  required={campo.required ?? true}
                  autoComplete={campo.autoComplete}
                />
              </div>
            ) : (
              <>
                <input
                  id={campo.name}
                  name={campo.name}
                  type={campo.type ?? 'text'}
                  required={campo.required ?? true}
                  readOnly={campo.fijo}
                  autoComplete={campo.autoComplete}
                  placeholder={campo.placeholder}
                  list={campo.sugerencias ? `sug-${campo.name}` : undefined}
                  defaultValue={estado.valores?.[campo.name] ?? campo.valorInicial}
                  className="campo mt-1.5"
                />
                {campo.sugerencias && (
                  <datalist id={`sug-${campo.name}`}>
                    {campo.sugerencias.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
              </>
            )}
            {campo.ayuda && <p className="mt-1 text-xs text-muted">{campo.ayuda}</p>}
          </div>
        ))}

        {estado.error && (
          <p role="alert" className="rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.aviso && (
          <p role="status" className="rounded-lg bg-brand-suave px-3 py-2 text-sm text-brand">
            {estado.aviso}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="boton boton-primario w-full"
        >
          {pendiente ? 'Un momento…' : cta}
        </button>
      </form>

      {pie && (
        <p className="mt-6 text-center text-sm text-muted">
          {pie.texto}{' '}
          <Link href={pie.href} className="font-medium text-acento hover:underline">
            {pie.enlace}
          </Link>
        </p>
      )}
    </main>
  )
}
