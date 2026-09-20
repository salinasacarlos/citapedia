// La receta impresa: que quepa, que no se encime sobre la firma, y que salga
// un PDF de verdad.
//
// Se prueba contra un "papel" sintético del tamaño de una carta, que es lo que
// usa cualquier papelería en México.

import { PDFDocument, PDFRawStream, rgb } from 'pdf-lib'
import { construirReceta, type MedicamentoImpreso } from '../src/lib/receta/pdf'
import { writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

/**
 * El texto que de verdad quedó dibujado en la hoja.
 *
 * Buscarlo en los bytes crudos no sirve: pdf-lib comprime el contenido con
 * Flate, así que una prueba escrita así **pasa cuando no encuentra nada** —
 * que es la peor forma de fallar, y así empezó esta. Hay que recorrer los
 * objetos del PDF, inflar cada flujo, y además **decodificar el hexadecimal**:
 * pdf-lib escribe `<58696D656E61> Tj`, no `(Ximena) Tj`.
 */
async function textoDibujado(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes)
  let junto = ''

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const datos = Buffer.from(obj.asUint8Array())
    try {
      junto += inflateSync(datos).toString('latin1')
    } catch {
      junto += datos.toString('latin1')
    }
  }

  return junto.replace(/<([0-9A-Fa-f]+)>/g, (entero, hex: string) =>
    hex.length % 2 === 0 ? Buffer.from(hex, 'hex').toString('latin1') : entero,
  )
}

let fallas = 0
function check(que: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${que}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallas++
}

/** Un membrete de mentiras: banda arriba, banda abajo, centro libre. */
async function papelDePrueba(ancho = 612, alto = 792) {
  const pdf = await PDFDocument.create()
  const p = pdf.addPage([ancho, alto])
  p.drawRectangle({ x: 0, y: alto - 150, width: ancho, height: 150, color: rgb(0.9, 0.96, 0.95) })
  p.drawText('Dr. Ernesto Peña · Cédula 1234567', { x: 40, y: alto - 60, size: 14 })
  p.drawRectangle({ x: 0, y: 0, width: ancho, height: 110, color: rgb(0.95, 0.95, 0.95) })
  p.drawText('Firma _______________', { x: 40, y: 60, size: 11 })
  return pdf.save()
}

const MEDICAMENTOS: MedicamentoImpreso[] = [
  {
    medicamento: 'Amoxicilina suspensión 250 mg/5 ml',
    dosis: '5 ml',
    frecuencia: 'cada 8 horas',
    duracion: '7 días',
    indicaciones: 'Con alimentos. Terminar el frasco aunque se sienta mejor.',
  },
  {
    medicamento: 'Paracetamol gotas',
    dosis: '0.8 ml',
    frecuencia: 'cada 6 horas si hay fiebre',
    duracion: null,
    indicaciones: null,
  },
]

async function correr() {
  const papel = await papelDePrueba()

  console.log('\nLa receta sobre el papel del médico')

  const pdf = await construirReceta({
    paciente: 'Ximena Robles Peña',
    edad: '3 años',
    fecha: 'martes 15 de septiembre de 2026',
    medicamentos: MEDICAMENTOS,
    indicacionesGenerales: 'Volver si la fiebre no cede en 48 horas.',
    papel: { bytes: papel, mime: 'application/pdf', margenArriba: 60, margenAbajo: 40 },
  })

  const texto = await textoDibujado(pdf)
  check('sale un PDF de verdad', Buffer.from(pdf).toString('latin1').startsWith('%PDF'))
  check('con el nombre del paciente', texto.includes('Ximena Robles'))
  check('y los medicamentos', texto.includes('Amoxicilina') && texto.includes('Paracetamol'))
  check('las indicaciones generales también', texto.includes('Volver si la fiebre'))

  const doc = await PDFDocument.load(pdf)
  check('una sola hoja', doc.getPageCount() === 1)
  const { width, height } = doc.getPage(0).getSize()
  check('del tamaño del papel, no del nuestro', Math.round(width) === 612 && Math.round(height) === 792)

  console.log('\nLo que no cabe no se encima')

  // Margen de 200 mm arriba y 200 abajo sobre una carta (279 mm) no deja aire:
  // lo correcto es no escribir nada, nunca encimarse sobre la firma.
  const apretada = await construirReceta({
    paciente: 'Ximena Robles Peña',
    edad: null,
    fecha: 'martes 15 de septiembre de 2026',
    medicamentos: MEDICAMENTOS,
    indicacionesGenerales: null,
    papel: { bytes: papel, mime: 'application/pdf', margenArriba: 200, margenAbajo: 200 },
  })
  const apretadaTexto = await textoDibujado(apretada)
  check('sin espacio libre no escribe nada', !apretadaTexto.includes('Amoxicilina'))
  check('pero sigue siendo un PDF abrible', Buffer.from(apretada).toString('latin1').startsWith('%PDF'))

  console.log('\nDetalles que romperían la impresión')

  const conAcentos = await construirReceta({
    paciente: 'Ángel Muñoz Peña',
    edad: '8 años',
    fecha: 'miércoles 16 de septiembre de 2026',
    medicamentos: [
      {
        medicamento: 'Ibuprofeno · suspensión',
        dosis: '7 ml',
        frecuencia: 'cada 8 h',
        duracion: '3 días',
        indicaciones: 'Náusea, vómito o dolor de estómago: suspender.',
      },
    ],
    indicacionesGenerales: null,
    papel: { bytes: papel, mime: 'application/pdf', margenArriba: 60, margenAbajo: 40 },
  })
  const acentuado = await textoDibujado(conAcentos)
  check('los acentos y las eñes no truenan', acentuado.includes('Mu') && acentuado.includes('Ibuprofeno'))

  // Media carta: el papel manda el tamaño, no nosotros.
  const media = await construirReceta({
    paciente: 'Ximena Robles',
    edad: null,
    fecha: 'martes 15',
    medicamentos: [MEDICAMENTOS[1]],
    indicacionesGenerales: null,
    papel: {
      bytes: await papelDePrueba(396, 612),
      mime: 'application/pdf',
      margenArriba: 40,
      margenAbajo: 30,
    },
  })
  const docMedia = await PDFDocument.load(media)
  const medidas = docMedia.getPage(0).getSize()
  check(
    'una receta de media carta sale de media carta',
    Math.round(medidas.width) === 396 && Math.round(medidas.height) === 612,
  )

  // El médico que no quiere estructurar nada también imprime: la receta se
  // arma con puras indicaciones, sin un solo medicamento capturado.
  const soloIndicaciones = await construirReceta({
    paciente: 'Ximena Robles',
    edad: null,
    fecha: 'martes 15 de septiembre de 2026',
    medicamentos: [],
    indicacionesGenerales: 'Reposo dos días. Líquidos. Volver si sigue la fiebre.',
    papel: { bytes: papel, mime: 'application/pdf', margenArriba: 60, margenAbajo: 40 },
  })
  const textoSolo = await textoDibujado(soloIndicaciones)
  check('sin medicamentos, la receta sale con las indicaciones', textoSolo.includes('Reposo dos'))
  check('y con el nombre del paciente', textoSolo.includes('Ximena Robles'))

  const muchos = await construirReceta({
    paciente: 'Paciente Con Muchos',
    edad: null,
    fecha: 'martes 15',
    medicamentos: Array.from({ length: 30 }, (_, i) => ({
      medicamento: `Medicamento número ${i + 1} con nombre comercial largo`,
      dosis: '1 tableta',
      frecuencia: 'cada 12 horas',
      duracion: '10 días',
      indicaciones: 'Una indicación razonablemente larga para forzar el acomodo del texto.',
    })),
    indicacionesGenerales: null,
    papel: { bytes: papel, mime: 'application/pdf', margenArriba: 60, margenAbajo: 40 },
  })
  const docMuchos = await PDFDocument.load(muchos)
  check('treinta medicamentos no desbordan la hoja', docMuchos.getPageCount() === 1)

  writeFileSync(process.env.MUESTRA_RECETA ?? '/tmp/receta-muestra.pdf', Buffer.from(pdf))

  console.log(fallas === 0 ? '\n✅ Receta verificada.' : `\n❌ ${fallas} fallas.`)
  process.exit(fallas === 0 ? 0 : 1)

}

correr()
