'use client'

import { useEffect, useRef, useState } from 'react'

export type EstudioVisible = {
  id: string
  filename: string
  kind: string | null
  mime: string
  size_bytes: number
  created_at: string | null
  url: string | null
}

const ZOOMS = [1, 1.5, 2, 3, 4] as const

/**
 * Ver el estudio sin salir del expediente.
 *
 * Bajarlo para mirarlo significa abrir el Finder, buscar el archivo y volver
 * — con el paciente enfrente, eso es media consulta. Los PDF los pinta el
 * navegador, que ya trae su propio zoom; las imágenes necesitan el nuestro,
 * porque una radiografía sin acercar no se lee.
 */
export function VisorEstudio({
  estudio,
  onCerrar,
}: {
  estudio: EstudioVisible
  onCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [zoom, setZoom] = useState(1)
  const [origen, setOrigen] = useState({ x: 0, y: 0 })
  const arrastre = useRef<{ x: number; y: number } | null>(null)

  const esImagen = estudio.mime.startsWith('image/')
  // El navegador no pinta HEIC: mejor decirlo que mostrar un cuadro roto.
  const sePuedeVer = estudio.mime === 'application/pdf' || (esImagen && estudio.mime !== 'image/heic')

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  function acercar(paso: number) {
    // Actualización funcional: dos clics rápidos leerían el mismo valor de la
    // clausura y avanzarían un solo paso.
    setZoom((actual) => {
      const i = ZOOMS.indexOf(actual as (typeof ZOOMS)[number])
      const siguiente = ZOOMS[Math.min(Math.max(i + paso, 0), ZOOMS.length - 1)]
      if (siguiente === 1) setOrigen({ x: 0, y: 0 })
      return siguiente
    })
  }

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      className="m-auto max-h-[92dvh] w-[min(72rem,calc(100vw-2rem))] rounded-marca border border-border bg-surface p-0 text-foreground backdrop:bg-ink/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{estudio.filename}</p>
          {estudio.kind && <p className="text-xs text-brand">{estudio.kind}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {esImagen && sePuedeVer && (
            <>
              <button
                type="button"
                onClick={() => acercar(-1)}
                disabled={zoom === ZOOMS[0]}
                aria-label="Alejar"
                className="boton boton-suave size-8 p-0 text-base disabled:opacity-40"
              >
                −
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-muted">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => acercar(1)}
                disabled={zoom === ZOOMS[ZOOMS.length - 1]}
                aria-label="Acercar"
                className="boton boton-suave size-8 p-0 text-base disabled:opacity-40"
              >
                +
              </button>
            </>
          )}
          {estudio.url && (
            <a
              href={estudio.url}
              download={estudio.filename}
              className="boton boton-suave px-3 py-1.5 text-xs"
            >
              Descargar
            </a>
          )}
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="boton boton-suave size-8 p-0"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex max-h-[calc(92dvh-4rem)] justify-center overflow-auto bg-surface-2 p-3">
        {!estudio.url ? (
          <p className="p-8 text-sm text-muted">No se pudo abrir el archivo.</p>
        ) : !sePuedeVer ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted">
              Este formato no se puede ver aquí. Descárgalo para abrirlo.
            </p>
          </div>
        ) : esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={estudio.url}
            alt={estudio.filename}
            draggable={false}
            onMouseDown={(e) => {
              if (zoom === 1) return
              arrastre.current = { x: e.clientX - origen.x, y: e.clientY - origen.y }
            }}
            onMouseMove={(e) => {
              if (!arrastre.current) return
              setOrigen({
                x: e.clientX - arrastre.current.x,
                y: e.clientY - arrastre.current.y,
              })
            }}
            onMouseUp={() => (arrastre.current = null)}
            onMouseLeave={() => (arrastre.current = null)}
            style={{
              transform: `translate(${origen.x}px, ${origen.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? 'grab' : 'default',
            }}
            className="max-h-full origin-center object-contain transition-transform"
          />
        ) : (
          <iframe
            src={estudio.url}
            title={estudio.filename}
            className="h-[calc(92dvh-5rem)] w-full rounded-marca border-0 bg-surface"
          />
        )}
      </div>
    </dialog>
  )
}
