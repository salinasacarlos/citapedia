'use client'

import { useEffect, useRef } from 'react'

/**
 * Diálogo para lo que no tiene vuelta atrás.
 *
 * Usa `<dialog>` nativo: trae el foco atrapado, el cierre con Escape y el
 * fondo inerte sin que haya que reimplementarlos mal. Se abre con
 * `showModal()` desde un efecto porque el atributo `open` renderiza el
 * diálogo sin modalidad, que es justo lo que no queremos aquí.
 */
export function ConfirmarAccion({
  abierto,
  titulo,
  detalle,
  confirmar,
  onCancelar,
  onConfirmar,
  pendiente = false,
  confirmarDeshabilitado = false,
  tono = 'peligro',
}: {
  abierto: boolean
  titulo: string
  detalle: React.ReactNode
  /** El texto del botón que hace la cosa. Nunca "Aceptar": di qué va a pasar. */
  confirmar: string
  onCancelar: () => void
  onConfirmar: () => void
  pendiente?: boolean
  /** Para cuando el diálogo pide algo antes de dejar continuar. */
  confirmarDeshabilitado?: boolean
  /** Este diálogo también sirve para elegir, no solo para lo destructivo. */
  tono?: 'peligro' | 'normal'
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCancelar()
      }}
      onClick={(e) => {
        // Clic en el fondo, fuera de la tarjeta: cerrar sin hacer nada.
        if (e.target === dialogo.current) onCancelar()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-marca border border-border bg-surface p-0 text-foreground backdrop:bg-ink/40"
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-bold text-ink">{titulo}</h2>
        <div className="mt-2 text-sm leading-relaxed text-muted">{detalle}</div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            className="boton boton-suave"
            disabled={pendiente}
          >
            {tono === 'peligro' ? 'Mejor no' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={pendiente || confirmarDeshabilitado}
            className={`boton disabled:opacity-50 ${
              tono === 'peligro'
                ? 'border border-peligro bg-peligro-suave font-semibold text-peligro hover:bg-peligro hover:text-white disabled:hover:bg-peligro-suave disabled:hover:text-peligro'
                : 'boton-primario'
            }`}
          >
            {pendiente ? 'Un momento…' : confirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
