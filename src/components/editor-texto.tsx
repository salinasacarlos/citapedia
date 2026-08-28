'use client'

import { useEffect, useRef, useState } from 'react'
import { aHtml } from '@/lib/texto-rico'
import { aMarkdown } from '@/lib/editor/serializar'

type Herramienta = {
  comando: string
  etiqueta: string
  titulo: string
  clase?: string
}

const HERRAMIENTAS: Herramienta[] = [
  { comando: 'bold', etiqueta: 'N', titulo: 'Negritas', clase: 'font-bold' },
  { comando: 'italic', etiqueta: 'C', titulo: 'Cursivas', clase: 'italic' },
  { comando: 'insertUnorderedList', etiqueta: '•', titulo: 'Lista con viñetas' },
  { comando: 'insertOrderedList', etiqueta: '1.', titulo: 'Lista numerada' },
]

/**
 * Editor de texto con formato: se ve como queda mientras se escribe.
 *
 * Lo que se GUARDA sigue siendo Markdown, no el HTML del editor. El DOM se
 * serializa a un subconjunto conocido en cada tecla, así que lo que llega a la
 * base es texto plano y acotado — guardar el HTML tal cual sería el camino
 * corto al XSS en la página pública del médico.
 *
 * Usa `execCommand`, que está marcado como obsoleto pero es lo único que
 * funciona en todos los navegadores sin traerse un editor entero. El día que
 * deje de existir, lo que se cambia es esta capa: el formato guardado no se
 * entera.
 */
export function EditorTexto({
  name,
  defaultValue = '',
  placeholder,
}: {
  name: string
  defaultValue?: string
  placeholder?: string
}) {
  const [markdown, setMarkdown] = useState(defaultValue)
  const [vacio, setVacio] = useState(defaultValue.trim() === '')
  const [activos, setActivos] = useState<Record<string, boolean>>({})
  const area = useRef<HTMLDivElement>(null)

  // El contenido inicial se siembra una sola vez: React no debe repintar el
  // contenteditable, o el cursor salta al principio en cada tecla.
  useEffect(() => {
    if (area.current) area.current.innerHTML = aHtml(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function sincronizar() {
    if (!area.current) return
    setMarkdown(aMarkdown(area.current))
    setVacio((area.current.textContent ?? '').trim() === '')
  }

  /** Para prender el botón cuando el cursor está dentro de una negrita. */
  function revisarEstado() {
    const estado: Record<string, boolean> = {}
    for (const h of HERRAMIENTAS) {
      try {
        estado[h.comando] = document.queryCommandState(h.comando)
      } catch {
        estado[h.comando] = false
      }
    }
    setActivos(estado)
  }

  function aplicar(comando: string) {
    area.current?.focus()
    document.execCommand(comando)
    sincronizar()
    revisarEstado()
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-t-marca border border-b-0 border-border bg-surface-2 px-2 py-1.5">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.comando}
            type="button"
            title={h.titulo}
            aria-label={h.titulo}
            aria-pressed={activos[h.comando] ?? false}
            // El mousedown se cancela para no perder la selección al pulsar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicar(h.comando)}
            className={`h-7 min-w-7 rounded px-1.5 text-sm transition ${h.clase ?? ''} ${
              activos[h.comando] ? 'bg-brand-suave text-brand' : 'hover:bg-surface'
            }`}
          >
            {h.etiqueta}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={area}
          id={name}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          onInput={sincronizar}
          onBlur={sincronizar}
          onKeyUp={revisarEstado}
          onMouseUp={revisarEstado}
          // Pegar va como texto plano: lo que viene de Word trae estilos,
          // fuentes y a veces markup entero que no queremos guardar.
          onPaste={(e) => {
            e.preventDefault()
            const plano = e.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, plano)
            sincronizar()
          }}
          className="campo min-h-40 space-y-3 overflow-y-auto rounded-t-none text-left [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
        />
        {vacio && placeholder && (
          <p className="pointer-events-none absolute top-3 left-3 text-sm text-muted opacity-60">
            {placeholder}
          </p>
        )}
      </div>

      {/* Lo que viaja en el formulario es el Markdown, no el HTML. */}
      <input type="hidden" name={name} value={markdown} />
    </div>
  )
}
