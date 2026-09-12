// Lo que el paciente termina viendo.
//
// La bio la escribe el médico y la lee cualquiera, así que lo que importa aquí
// no es que el formato se vea bonito: es que nada de lo que se escriba pueda
// convertirse en algo ejecutable en la página pública.

import { renderToStaticMarkup } from 'react-dom/server'
import { TextoRico, aHtml, enTextoPlano } from '../src/lib/texto-rico'

let fallas = 0

function revisar(que: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    console.log(`  ok   ${que}`)
  } else {
    fallas++
    console.log(`  MAL  ${que}${detalle ? ` → ${detalle}` : ''}`)
  }
}

function pintar(md: string) {
  return renderToStaticMarkup(<TextoRico texto={md} />)
}

console.log('\nFormato que se ve')
revisar('negritas', pintar('**hola**').includes('<strong'))
revisar('cursivas', pintar('*hola*').includes('<em>'))
revisar('tachado', pintar('~~hola~~').includes('<s>'))
revisar('viñetas', pintar('- uno\n- dos').includes('<ul'))
revisar('numerada', pintar('1. uno\n2. dos').includes('<ol'))
revisar('cita', pintar('> algo').includes('<blockquote'))

console.log('\nLigas')
const liga = pintar('[mi sitio](https://ejemplo.mx)')
revisar('una liga https se pinta', liga.includes('href="https://ejemplo.mx/"'))
revisar('y abre en otra pestaña sin pasar referrer', liga.includes('rel="noopener noreferrer nofollow"'))

for (const veneno of [
  '[clic](javascript:alert(1))',
  '[clic](JavaScript:alert(1))',
  '[clic](data:text/html,<script>alert(1)</script>)',
  '[clic](vbscript:msgbox)',
]) {
  const html = pintar(veneno)
  revisar(
    `no hace liga de ${veneno.slice(7, 30)}`,
    !html.includes('<a ') && !html.toLowerCase().includes('javascript:'),
    html.slice(0, 90),
  )
}

console.log('\nNada de HTML del usuario llega crudo')
const inyeccion = pintar('<script>alert(1)</script> y <img src=x onerror=alert(1)>')
revisar('el script se muestra como texto', !inyeccion.includes('<script>'))
revisar('la imagen tampoco entra', !inyeccion.includes('<img src=x'))

const enLiga = pintar('[<script>x</script>](https://ejemplo.mx)')
revisar('ni dentro del texto de una liga', !enLiga.includes('<script>'))

console.log('\nSembrar el editor (aHtml)')
revisar('tachado', aHtml('~~x~~').includes('<s>'))
revisar('cita', aHtml('> x').includes('<blockquote>'))
revisar('liga buena', aHtml('[y](https://ejemplo.mx)').includes('<a href="https://ejemplo.mx/"'))
revisar('liga con javascript queda como texto', !aHtml('[y](javascript:alert(1))').includes('<a '))
revisar(
  'comillas en el texto no rompen el atributo',
  !aHtml('[a"b](https://ejemplo.mx)').includes('"a"b"'),
)

console.log('\nEn plano, para la vista previa de WhatsApp')
revisar('los asteriscos no se ven', enTextoPlano('de la **UNAM**') === 'de la UNAM')
revisar('el tachado tampoco', enTextoPlano('~~no~~ sí') === 'no sí')
revisar('la liga aporta su texto, no su dirección', enTextoPlano('[mi sitio](https://x.mx)') === 'mi sitio')
revisar('las viñetas se aplanan', enTextoPlano('- uno\n- dos') === 'uno dos')
revisar('la cita también', enTextoPlano('> algo') === 'algo')
revisar('el CRLF no deja renglones pegados', !enTextoPlano('uno\r\ndos').includes('unodos'))
revisar(
  'corta sin partir palabras y avisa con puntos suspensivos',
  (() => {
    const r = enTextoPlano('palabra '.repeat(40), 40)
    return r.length <= 40 && r.endsWith('…') && !r.includes('pala ')
  })(),
)

console.log(fallas === 0 ? '\n✅ Texto verificado.' : `\n❌ ${fallas} fallas.`)
process.exit(fallas === 0 ? 0 : 1)
