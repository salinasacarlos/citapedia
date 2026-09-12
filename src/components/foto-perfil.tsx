'use client'

import { useActionState, useRef, useState } from 'react'
import { quitarFoto, subirFoto, type Resultado } from '@/lib/admin/actions'

/** El mismo tope que revisa el servidor, para avisar sin subir nada. */
const MAX_FOTO = 5 * 1024 * 1024

export function FotoPerfil({
  fotoActual,
  nombre,
}: {
  fotoActual: string | null
  nombre: string
}) {
  const [estado, formAction, pendiente] = useActionState<Resultado, FormData>(subirFoto, {})
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [pesada, setPesada] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const mostrada = vistaPrevia ?? fotoActual
  const inicial = nombre.replace(/^(dr|dra)\.?\s*/i, '').charAt(0).toUpperCase()

  return (
    <div className="flex flex-wrap items-center gap-5">
      {mostrada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mostrada}
          alt=""
          className="size-24 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-brand-suave text-3xl font-bold text-brand"
        >
          {inicial}
        </div>
      )}

      <div className="min-w-0">
        <form ref={formRef} action={formAction}>
          <input
            ref={inputRef}
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (!archivo) return

              // Se revisa aquí y no solo en el servidor: mandar ocho megas
              // por una red de consultorio para que del otro lado digan que
              // no, es esperar un minuto para nada.
              if (archivo.size > MAX_FOTO) {
                const mb = (archivo.size / 1024 / 1024).toFixed(1)
                setPesada(`La foto pesa ${mb} MB y el máximo son 5 MB.`)
                e.target.value = ''
                return
              }

              setPesada(null)
              // Se ve de inmediato mientras sube, sin esperar al servidor.
              setVistaPrevia(URL.createObjectURL(archivo))
              formRef.current?.requestSubmit()
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={() => inputRef.current?.click()}
              className="boton boton-suave"
            >
              {pendiente ? 'Subiendo…' : fotoActual ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {fotoActual && !pendiente && (
              <button
                type="button"
                onClick={() => {
                  setVistaPrevia(null)
                  quitarFoto()
                }}
                className="boton px-3 py-1.5 text-xs text-muted hover:text-peligro"
              >
                Quitar
              </button>
            )}
          </div>
        </form>

        <p className="mt-2 text-xs text-muted">JPG, PNG o WebP. Máximo 5 MB.</p>

        {pesada && (
          <p role="alert" className="mt-2 text-sm text-peligro">
            {pesada}
          </p>
        )}
        {!pesada && estado.error && (
          <p role="alert" className="mt-2 text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="mt-2 text-sm text-exito">
            {estado.ok}
          </p>
        )}
      </div>
    </div>
  )
}
