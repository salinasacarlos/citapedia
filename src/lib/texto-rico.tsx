import type { ReactNode } from 'react'

/**
 * Un subconjunto mínimo de Markdown, renderizado como elementos de React.
 *
 * Nunca se inyecta HTML: lo que el médico escribe termina en nodos de texto,
 * así que no hay forma de que un `<script>` en su perfil llegue a la página
 * pública. Esa es la razón de guardar Markdown y no HTML de un editor
 * WYSIWYG — no ahorrar una dependencia.
 *
 * Entiende: **negritas**, *cursivas*, listas con "- ", y párrafos separados
 * por una línea en blanco. Lo demás se muestra tal cual se escribió.
 */

function conFormato(linea: string, clave: string): ReactNode {
  // Se parte por los marcadores conservándolos, para reconstruir en orden.
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

export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  const lineas = texto.split('\n')
  const bloques: ReactNode[] = []
  let vinetas: string[] = []
  let parrafo: string[] = []

  function cerrarParrafo() {
    if (parrafo.length === 0) return
    const contenido = parrafo
    bloques.push(
      <p key={`p-${bloques.length}`}>
        {contenido.map((l, i) => (
          <span key={i}>
            {conFormato(l, `${bloques.length}-${i}`)}
            {i < contenido.length - 1 && <br />}
          </span>
        ))}
      </p>,
    )
    parrafo = []
  }

  function cerrarLista() {
    if (vinetas.length === 0) return
    const items = vinetas
    bloques.push(
      <ul key={`u-${bloques.length}`} className="list-disc space-y-1 pl-5">
        {items.map((v, i) => (
          <li key={i}>{conFormato(v, `${bloques.length}-${i}`)}</li>
        ))}
      </ul>,
    )
    vinetas = []
  }

  for (const linea of lineas) {
    const vineta = linea.match(/^\s*[-*•]\s+(.*)$/)
    if (vineta) {
      cerrarParrafo()
      vinetas.push(vineta[1])
      continue
    }
    if (linea.trim() === '') {
      cerrarLista()
      cerrarParrafo()
      continue
    }
    cerrarLista()
    parrafo.push(linea)
  }
  cerrarLista()
  cerrarParrafo()

  return <div className={`space-y-3 ${className ?? ''}`}>{bloques}</div>
}
