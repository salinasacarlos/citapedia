'use client'

import { useState } from 'react'
import { TextoRico } from '@/lib/texto-rico'

/**
 * Un texto largo no debe empujar el calendario fuera de la pantalla: quien
 * llega a esta página viene a agendar. Se muestra el principio y se ofrece el
 * resto a un clic.
 */
/**
 * Cortar a la mitad puede dejar un `**` o un `*` abierto, y entonces el
 * asterisco se ve crudo en la página. Se cierra lo que quedó abierto: el
 * texto se lee con formato en vez de con basura.
 */
function cerrarMarcadores(texto: string): string {
  let cerrado = texto
  if ((cerrado.match(/\*\*/g)?.length ?? 0) % 2 === 1) cerrado += '**'
  // Las cursivas se cuentan sobre lo que queda fuera de las negritas.
  const sueltos = cerrado.replace(/\*\*/g, '').match(/\*/g)?.length ?? 0
  if (sueltos % 2 === 1) cerrado += '*'
  return cerrado
}

export function TextoExpandible({
  texto,
  limite = 320,
  className,
}: {
  texto: string
  /** Desde cuántos caracteres vale la pena recortar. */
  limite?: number
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const largo = texto.length > limite

  if (!largo) return <TextoRico texto={texto} className={className} />

  // Se corta en el último espacio para no partir una palabra a la mitad.
  const corte = texto.slice(0, limite)
  const recortado = cerrarMarcadores(
    corte.slice(0, Math.max(corte.lastIndexOf(' '), limite - 40)),
  )

  return (
    <div>
      <TextoRico texto={abierto ? texto : `${recortado}…`} className={className} />
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="mt-2 text-sm font-semibold text-acento hover:underline"
      >
        {abierto ? 'Ver menos' : 'Ver más'}
      </button>
    </div>
  )
}
