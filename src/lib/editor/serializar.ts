/**
 * Del DOM del editor al Markdown que se guarda.
 *
 * Solo se reconoce lo que la barra puede producir: negritas, cursivas,
 * tachado, ligas, citas y los dos tipos de lista. Cualquier otra etiqueta —la que llegue al pegar desde
 * Word, por ejemplo— aporta su texto y nada más. Así lo que entra a la base
 * queda acotado por construcción, en vez de por un saneador que hay que
 * mantener al día.
 */

const NEGRITAS = new Set(['STRONG', 'B'])
const CURSIVAS = new Set(['EM', 'I'])
const TACHADO = new Set(['S', 'STRIKE', 'DEL'])

function texto(nodo: Node): string {
  if (nodo.nodeType === Node.TEXT_NODE) {
    // Los asteriscos escritos a mano se escapan: si no, al volver a abrir el
    // editor se leerían como formato que el médico nunca pidió.
    return (nodo.textContent ?? '').replace(/([*~])/g, '\\$1')
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return ''

  const el = nodo as HTMLElement
  const dentro = [...el.childNodes].map(texto).join('')

  if (el.tagName === 'BR') return ''
  if (dentro.trim() === '') return dentro
  if (NEGRITAS.has(el.tagName)) return `**${dentro}**`
  if (CURSIVAS.has(el.tagName)) return `*${dentro}*`
  if (TACHADO.has(el.tagName)) return `~~${dentro}~~`
  if (el.tagName === 'A') {
    const url = (el as HTMLAnchorElement).getAttribute('href') ?? ''
    // Sin dirección no es liga, es texto. Y el texto no puede traer los
    // corchetes crudos o el formato guardado dejaría de leerse.
    if (!url) return dentro
    return `[${dentro.replace(/[[\]]/g, '')}](${url})`
  }
  return dentro
}

/**
 * Recorre buscando bloques. Es recursivo porque el navegador no promete dónde
 * pone una lista: al escribir puede quedar dentro de un `div`, y mirando solo
 * el primer nivel se aplastaría en una línea sin viñetas.
 */
function recorrer(nodo: Node, lineas: string[]): void {
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === Node.TEXT_NODE) {
      const t = texto(hijo)
      if (t.trim()) lineas.push(t)
      continue
    }
    if (hijo.nodeType !== Node.ELEMENT_NODE) continue

    const el = hijo as HTMLElement

    if (el.tagName === 'BLOCKQUOTE') {
      // Una cita puede traer párrafos dentro o ser texto suelto con formato.
      // Si se recorriera siempre, `<b>Hola</b> y <i>adiós</i>` saldría en tres
      // renglones, y cada uno se leería como una cita distinta.
      const porBloques = el.querySelector('p, div, ul, ol')
      const dentro: string[] = []
      if (porBloques) recorrer(el, dentro)
      else dentro.push(texto(el))

      // Cada renglón lleva su propio `>`: una cita de dos líneas que solo
      // marcara la primera se leería como cita más un párrafo suelto.
      for (const l of dentro) {
        if (l.trim()) lineas.push(`> ${l.trim()}`)
      }
      continue
    }

    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const numerada = el.tagName === 'OL'
      ;[...el.children].forEach((li, i) => {
        lineas.push(`${numerada ? `${i + 1}.` : '-'} ${texto(li)}`)
      })
      continue
    }

    // Un contenedor con una lista dentro se abre; uno de puro texto es una
    // línea y se toma entero, para no perder su formato en línea.
    if (el.querySelector('ul, ol')) {
      recorrer(el, lineas)
      continue
    }

    lineas.push(texto(el))
  }
}

export function aMarkdown(raiz: HTMLElement): string {
  const lineas: string[] = []
  recorrer(raiz, lineas)

  return lineas
    .join('\n')
    // Tres saltos o más no aportan nada y ensucian lo guardado.
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
