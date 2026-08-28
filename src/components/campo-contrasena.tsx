'use client'

import { useState } from 'react'

/**
 * Contraseña con botón para verla.
 *
 * Escribir a ciegas es de donde salen la mitad de los "correo o contraseña
 * incorrectos", y en un consultorio la pantalla no suele tener a nadie
 * mirando por encima del hombro. Arranca oculta: quien necesite verla, la ve.
 */
export function CampoContrasena({
  id,
  name,
  required = true,
  autoComplete,
  minLength,
  defaultValue,
  className,
}: {
  id?: string
  name: string
  required?: boolean
  autoComplete?: string
  minLength?: number
  defaultValue?: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id ?? name}
        name={name}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        // Espacio a la derecha para que el texto no pase por debajo del botón.
        className={`campo pr-16 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Sin esto, pulsar el botón saca el foco del campo antes del clic.
        onMouseDown={(e) => e.preventDefault()}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-acento hover:underline"
      >
        {visible ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}
