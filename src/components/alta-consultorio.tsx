'use client'

import { useActionState, useState } from 'react'
import { crearConsultorio, type ResultadoPlataforma } from '@/lib/plataforma/actions'
import { CopiarLiga } from '@/components/copiar-liga'

/**
 * Alta de un consultorio desde la consola.
 *
 * No se pide contraseña: se crea la cuenta y el médico elige la suya con la
 * liga. Una contraseña temporal tendría que viajar por algún lado, y ese lado
 * siempre termina siendo WhatsApp.
 */
export function AltaConsultorio() {
  const [estado, formAction, pendiente] = useActionState<ResultadoPlataforma, FormData>(
    crearConsultorio,
    {},
  )
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton boton-primario"
      >
        Dar de alta un consultorio
      </button>
    )
  }

  return (
    <div className="tarjeta w-full p-4 sm:p-5">
      <form action={formAction} className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="nombre" className="block text-xs font-medium text-muted">
            Nombre del médico
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            placeholder="Dra. Lucía Ferrer"
            className="campo mt-1"
          />
        </div>
        <div>
          <label htmlFor="especialidad" className="block text-xs font-medium text-muted">
            Especialidad <span className="opacity-60">opcional</span>
          </label>
          <input
            id="especialidad"
            name="especialidad"
            placeholder="Pediatría"
            className="campo mt-1"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-muted">
            Correo de acceso
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="medico@ejemplo.com"
            className="campo mt-1"
          />
        </div>

        <div className="flex gap-2 sm:col-span-3">
          <button disabled={pendiente} className="boton boton-primario">
            {pendiente ? 'Creando…' : 'Crear consultorio'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-suave"
          >
            Cerrar
          </button>
        </div>
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

      {estado.liga && (
        <div className="mt-3 rounded-marca border border-brand/30 bg-brand-suave p-4">
          <p className="text-sm font-semibold text-ink">Pásale esta liga al médico</p>
          <p className="mt-1 text-xs text-muted">
            Con ella elige su propia contraseña — tú nunca la ves. Se usa una sola vez
            y vence; si se pierde, se genera otra.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={estado.liga}
              onFocus={(e) => e.currentTarget.select()}
              className="campo min-w-0 flex-1 font-mono text-xs"
              aria-label="Liga de acceso"
            />
            <CopiarLiga liga={estado.liga} />
          </div>
        </div>
      )}
    </div>
  )
}
