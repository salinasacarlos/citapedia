'use client'

import { useEffect, useRef, useState } from 'react'
import { aHtml } from '@/lib/texto-rico'
import { aMarkdown } from '@/lib/editor/serializar'
import { Iconos } from '@/components/editor-iconos'

type Herramienta = {
  comando: string
  Icono: () => React.ReactElement
  titulo: string
  /** Los que se pueden ver prendidos según dónde esté el cursor. */
  conEstado?: boolean
  /** Empieza un grupo: separador antes. */
  separa?: boolean
}

const HERRAMIENTAS: Herramienta[] = [
  { comando: 'bold', Icono: Iconos.bold, titulo: 'Negritas (⌘B)', conEstado: true },
  { comando: 'italic', Icono: Iconos.italic, titulo: 'Cursivas (⌘I)', conEstado: true },
  { comando: 'strikeThrough', Icono: Iconos.strike, titulo: 'Tachado', conEstado: true },
  { comando: 'liga', Icono: Iconos.liga, titulo: 'Liga', separa: true },
  {
    comando: 'insertUnorderedList',
    Icono: Iconos.vinetas,
    titulo: 'Lista con viñetas',
    conEstado: true,
    separa: true,
  },
  {
    comando: 'insertOrderedList',
    Icono: Iconos.numerada,
    titulo: 'Lista numerada',
    conEstado: true,
  },
  { comando: 'formatBlock', Icono: Iconos.cita, titulo: 'Cita' },
  { comando: 'removeFormat', Icono: Iconos.limpiar, titulo: 'Quitar formato', separa: true },
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
  const [pidiendoLiga, setPidiendoLiga] = useState(false)
  const [url, setUrl] = useState('')
  const [avisoLiga, setAvisoLiga] = useState<string | null>(null)
  const area = useRef<HTMLDivElement>(null)
  /** La selección se guarda: al escribir la dirección se pierde. */
  const rango = useRef<Range | null>(null)

  // El contenido inicial se siembra una sola vez: React no debe repintar el
  // contenteditable, o el cursor salta al principio en cada tecla.
  useEffect(() => {
    if (area.current) area.current.innerHTML = aHtml(defaultValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function sincronizar() {
    // El aviso de "selecciona primero" no puede quedarse ahí: en cuanto se
    // escribe o se cambia algo, ya no describe lo que está pasando.
    if (avisoLiga) setAvisoLiga(null)
    if (!area.current) return
    setMarkdown(aMarkdown(area.current))
    setVacio((area.current.textContent ?? '').trim() === '')
  }

  /** Para prender el botón cuando el cursor está dentro de una negrita. */
  function revisarEstado() {
    const estado: Record<string, boolean> = {}
    for (const h of HERRAMIENTAS) {
      if (!h.conEstado) continue
      try {
        estado[h.comando] = document.queryCommandState(h.comando)
      } catch {
        estado[h.comando] = false
      }
    }
    setActivos(estado)
  }

  function aplicar(comando: string) {
    if (comando === 'liga') return abrirLiga()

    area.current?.focus()
    // La cita alterna: volver a picarle a una cita la deshace, o quedaría sin
    // forma de sacar un párrafo de ahí.
    if (comando === 'formatBlock') {
      const dentro = document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote'
      document.execCommand('formatBlock', false, dentro ? 'p' : 'blockquote')
    } else {
      document.execCommand(comando)
    }
    sincronizar()
    revisarEstado()
  }

  /**
   * La liga se pide en la misma barra y no con un `prompt` del navegador:
   * el prompt se ve como un error del sistema y no deja ver qué texto se está
   * ligando.
   */
  function abrirLiga() {
    const sel = window.getSelection()
    const texto = sel?.toString() ?? ''
    if (!texto.trim()) {
      setAvisoLiga('Selecciona primero el texto que quieres ligar.')
      return
    }
    rango.current = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null
    setAvisoLiga(null)
    setUrl('')
    setPidiendoLiga(true)
  }

  function confirmarLiga() {
    const limpia = url.trim()
    if (!limpia) return

    // Sin esquema, https. Quien escribe "midominio.com" quiere una liga, no
    // una ruta relativa que en la página pública no lleva a ningún lado.
    const conEsquema = /^https?:\/\//i.test(limpia) ? limpia : `https://${limpia}`
    try {
      new URL(conEsquema)
    } catch {
      setAvisoLiga('Esa dirección no se ve bien.')
      return
    }

    area.current?.focus()
    if (rango.current) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(rango.current)
    }
    document.execCommand('createLink', false, conEsquema)
    setPidiendoLiga(false)
    setUrl('')
    sincronizar()
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-marca border border-b-0 border-border bg-surface-2 px-2 py-1.5">
        {HERRAMIENTAS.map((h) => (
          <span key={h.comando} className="flex items-center">
            {h.separa && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
            <button
              type="button"
              title={h.titulo}
              aria-label={h.titulo}
              {...(h.conEstado ? { 'aria-pressed': activos[h.comando] ?? false } : {})}
              // El mousedown se cancela para no perder la selección al pulsar.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar(h.comando)}
              className={`flex size-7 items-center justify-center rounded transition ${
                activos[h.comando]
                  ? 'bg-brand-suave text-brand'
                  : 'text-ink/70 hover:bg-surface hover:text-ink'
              }`}
            >
              <h.Icono />
            </button>
          </span>
        ))}
      </div>

      {(pidiendoLiga || avisoLiga) && (
        <div className="flex flex-wrap items-center gap-2 border-x border-border bg-surface-2 px-2 pb-2">
          {pidiendoLiga ? (
            <>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    confirmarLiga()
                  }
                  if (e.key === 'Escape') setPidiendoLiga(false)
                }}
                placeholder="midominio.com"
                className="campo h-8 flex-1 py-0 text-sm"
              />
              <button
                type="button"
                onClick={confirmarLiga}
                className="boton boton-primario px-3 py-1 text-xs"
              >
                Ligar
              </button>
              <button
                type="button"
                onClick={() => setPidiendoLiga(false)}
                className="boton boton-suave px-3 py-1 text-xs"
              >
                Cancelar
              </button>
            </>
          ) : (
            <p className="text-xs text-muted">{avisoLiga}</p>
          )}
          {pidiendoLiga && avisoLiga && (
            <p className="w-full text-xs text-peligro">{avisoLiga}</p>
          )}
        </div>
      )}

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
          className="campo min-h-40 space-y-3 overflow-y-auto rounded-t-none text-left [&_a]:text-acento [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_blockquote]:italic [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
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
