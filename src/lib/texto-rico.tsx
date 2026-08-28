import type { ReactNode } from 'react'

/**
 * Un subconjunto mínimo de Markdown: **negritas**, *cursivas*, listas con
 * viñeta y listas numeradas.
 *
 * Es el formato en el que se GUARDA. La edición es WYSIWYG, pero lo que llega
 * a la base es texto plano: así lo que el médico escribe termina en nodos de
 * texto y no hay forma de que un `<script>` en su perfil se ejecute en la
 * página pública. Guardar el HTML del editor sería el camino corto al XSS.
 */

/**
 * Un botón de la barra presionado sin escribir nada deja marcadores vacíos.
 * No son formato, son basura, y el paciente los vería literales.
 */
function sinMarcadoresVacios(texto: string): string {
  return (
    texto
      // Windows y los textarea guardan CRLF. En una expresión regular de JS el
      // `\r` es fin de línea, así que `.` no lo cruza y `$` no llega: sin esto,
      // una viñeta guardada con CRLF deja de reconocerse como viñeta.
      .replace(/\r\n?/g, '\n')
      .replace(/\*{4}/g, '')
      .replace(/\*\*(\s*)\*\*/g, '$1')
    // Solo asteriscos que de verdad están solos: `**` es marcador de negritas,
    // no dos cursivas seguidas.
      .replace(/(?<!\*)\*(\s+)\*(?!\*)/g, '$1')
  )
}

function conFormato(linea: string, clave: string): ReactNode {
  const partes = linea.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)

  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      return (
        <strong key={`${clave}-${i}`} className="font-semibold text-foreground">
          {parte.slice(2, -2)}
        </strong>
      )
    }
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      return <em key={`${clave}-${i}`}>{parte.slice(1, -1)}</em>
    }
    return parte
  })
}

type Bloque = { tipo: 'p' | 'ul' | 'ol'; lineas: string[] }

/** Agrupa las líneas en párrafos y listas, que es todo lo que hay. */
function enBloques(texto: string): Bloque[] {
  const bloques: Bloque[] = []
  let actual: Bloque | null = null

  for (const linea of sinMarcadoresVacios(texto).split('\n')) {
    const vineta = linea.match(/^\s*[-*•]\s+(.*)$/)
    const numerada = linea.match(/^\s*\d+[.)]\s+(.*)$/)
    const tipo: Bloque['tipo'] = vineta ? 'ul' : numerada ? 'ol' : 'p'
    const contenido = vineta?.[1] ?? numerada?.[1] ?? linea

    if (tipo === 'p' && linea.trim() === '') {
      actual = null
      continue
    }
    if (!actual || actual.tipo !== tipo) {
      actual = { tipo, lineas: [] }
      bloques.push(actual)
    }
    actual.lineas.push(contenido)
  }

  return bloques
}

export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {enBloques(texto).map((b, i) => {
        if (b.tipo === 'p') {
          return (
            <p key={i}>
              {b.lineas.map((l, j) => (
                <span key={j}>
                  {conFormato(l, `${i}-${j}`)}
                  {j < b.lineas.length - 1 && <br />}
                </span>
              ))}
            </p>
          )
        }
        const Lista = b.tipo === 'ul' ? 'ul' : 'ol'
        return (
          <Lista
            key={i}
            className={`space-y-1 pl-5 ${b.tipo === 'ul' ? 'list-disc' : 'list-decimal'}`}
          >
            {b.lineas.map((l, j) => (
              <li key={j}>{conFormato(l, `${i}-${j}`)}</li>
            ))}
          </Lista>
        )
      })}
    </div>
  )
}

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function conFormatoHtml(linea: string): string {
  return escapar(linea)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
}

/**
 * El mismo Markdown, como HTML, para sembrar el editor WYSIWYG.
 *
 * El texto se escapa ANTES de meter las etiquetas: aunque esto solo recibe lo
 * que salió de nuestro propio editor, el día que alguien escriba en la base a
 * mano no debe poder inyectar nada.
 */
export function aHtml(texto: string): string {
  const bloques = enBloques(texto)
  if (bloques.length === 0) return '<p><br></p>'

  return bloques
    .map((b) => {
      if (b.tipo === 'p') {
        return b.lineas.map((l) => `<p>${conFormatoHtml(l) || '<br>'}</p>`).join('')
      }
      const etiqueta = b.tipo === 'ul' ? 'ul' : 'ol'
      const items = b.lineas.map((l) => `<li>${conFormatoHtml(l)}</li>`).join('')
      return `<${etiqueta}>${items}</${etiqueta}>`
    })
    .join('')
}
