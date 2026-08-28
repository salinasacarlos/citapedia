'use client'

import { useRef, useState } from 'react'
import { TextoRico } from '@/lib/texto-rico'

type Herramienta = {
  etiqueta: string
  titulo: string
  clase?: string
  aplicar: (texto: string, inicio: number, fin: number) => { texto: string; cursor: number }
}

/** Envuelve lo seleccionado; si no hay nada, deja el cursor entre los marcadores. */
function envolver(marca: string): Herramienta['aplicar'] {
  return (texto, inicio, fin) => {
    const dentro = texto.slice(inicio, fin)
    const nuevo = `${texto.slice(0, inicio)}${marca}${dentro || ''}${marca}${texto.slice(fin)}`
    return { texto: nuevo, cursor: inicio + marca.length + dentro.length }
  }
}

const HERRAMIENTAS: Herramienta[] = [
  { etiqueta: 'N', titulo: 'Negritas', clase: 'font-bold', aplicar: envolver('**') },
  { etiqueta: 'C', titulo: 'Cursivas', clase: 'italic', aplicar: envolver('*') },
  {
    etiqueta: '•',
    titulo: 'Lista',
    aplicar: (texto, inicio, fin) => {
      // Toma las líneas completas que toca la selección, no solo el trozo.
      const desde = texto.lastIndexOf('\n', inicio - 1) + 1
      const hasta = texto.indexOf('\n', fin) === -1 ? texto.length : texto.indexOf('\n', fin)
      const bloque = texto.slice(desde, hasta) || ''
      const conVinetas = bloque
        .split('\n')
        .map((l) => (l.trim().startsWith('- ') ? l : `- ${l}`))
        .join('\n')
      return {
        texto: texto.slice(0, desde) + conVinetas + texto.slice(hasta),
        cursor: desde + conVinetas.length,
      }
    },
  },
]

/**
 * Editor de texto con lo justo: negritas, cursivas y listas.
 *
 * Escribe Markdown en un textarea normal en vez de HTML en un contenteditable.
 * Así lo que se guarda es texto plano —imposible de convertir en `<script>` en
 * la página pública— y el médico puede escribir directo si ya sabe la notación.
 */
export function EditorTexto({
  name,
  defaultValue = '',
  rows = 8,
  placeholder,
}: {
  name: string
  defaultValue?: string
  rows?: number
  placeholder?: string
}) {
  const [texto, setTexto] = useState(defaultValue)
  const [previa, setPrevia] = useState(false)
  const campo = useRef<HTMLTextAreaElement>(null)

  function aplicar(h: Herramienta) {
    const el = campo.current
    if (!el) return
    const { texto: nuevo, cursor } = h.aplicar(texto, el.selectionStart, el.selectionEnd)
    setTexto(nuevo)
    // Devolver el foco después de pintar: si no, el médico pierde dónde iba.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-t-marca border border-b-0 border-border bg-surface-2 px-2 py-1.5">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.etiqueta}
            type="button"
            title={h.titulo}
            aria-label={h.titulo}
            onClick={() => aplicar(h)}
            className={`size-7 rounded text-sm transition hover:bg-surface ${h.clase ?? ''}`}
          >
            {h.etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPrevia((v) => !v)}
          className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-acento hover:underline"
        >
          {previa ? 'Seguir escribiendo' : 'Vista previa'}
        </button>
      </div>

      {previa ? (
        <div className="min-h-32 rounded-b-marca border border-border p-3 text-sm leading-relaxed text-muted">
          {texto.trim() ? (
            <TextoRico texto={texto} />
          ) : (
            <p className="opacity-60">Nada escrito todavía.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={campo}
          id={name}
          name={name}
          rows={rows}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="campo resize-y rounded-t-none"
        />
      )}

      {/* Cuando está en vista previa el textarea no existe, y sin esto el
          formulario se enviaría sin el campo. */}
      {previa && <input type="hidden" name={name} value={texto} />}

      <p className="mt-1 text-xs text-muted">
        Puedes escribir <strong>**negritas**</strong>, <em>*cursivas*</em> y listas con
        un guion al inicio.
      </p>
    </div>
  )
}
