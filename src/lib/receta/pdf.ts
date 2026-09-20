import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * La receta impresa, escrita sobre el papel del médico.
 *
 * No se genera un diseño nuestro a propósito. Lo que hace válida una receta en
 * México —nombre, cédula profesional, domicilio, firma— ya está impreso en el
 * papel del consultorio, y es justo lo que CitaPedia no puede afirmar por su
 * cuenta. Aquí solo se escribe encima, dentro del espacio que el médico marcó
 * como libre.
 *
 * Sin papel cargado no hay receta: es preferible no dar nada a dar una hoja
 * que parece una receta y no lo es.
 *
 * No lleva `server-only` —al revés que `acceso/ligas`— porque no toca llaves
 * ni base: es una función pura, y así se puede probar sin levantar Next. Quien
 * la llama es una ruta del servidor, que es donde vive el papel.
 */

/** Los milímetros que el médico mide con una regla, en puntos de PDF. */
const MM = 2.8346

/** Carta, que es lo que usa cualquier papelería en México. */
const CARTA = { ancho: 612, alto: 792 }

export type MedicamentoImpreso = {
  medicamento: string
  dosis: string | null
  frecuencia: string | null
  duracion: string | null
  indicaciones: string | null
}

export type DatosReceta = {
  paciente: string
  edad: string | null
  fecha: string
  medicamentos: MedicamentoImpreso[]
  /** Lo que el médico escribió en el tratamiento, si quiso escribir algo. */
  indicacionesGenerales: string | null
  papel: { bytes: Uint8Array; mime: string; margenArriba: number; margenAbajo: number }
}

/** Corta el texto en renglones que caben, midiendo con la fuente de verdad. */
function enRenglones(
  texto: string,
  ancho: number,
  tamaño: number,
  medir: (t: string, s: number) => number,
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const renglones: string[] = []
  let actual = ''

  for (const palabra of palabras) {
    const intento = actual ? `${actual} ${palabra}` : palabra
    if (medir(intento, tamaño) <= ancho) {
      actual = intento
    } else {
      if (actual) renglones.push(actual)
      actual = palabra
    }
  }
  if (actual) renglones.push(actual)
  return renglones
}

export async function construirReceta(d: DatosReceta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  let pagina
  if (d.papel.mime === 'application/pdf') {
    // El papel manda el tamaño: si su receta es media carta, la nuestra también.
    const original = await PDFDocument.load(d.papel.bytes)
    const [incrustada] = await pdf.embedPdf(original, [0])
    pagina = pdf.addPage([incrustada.width, incrustada.height])
    pagina.drawPage(incrustada, { x: 0, y: 0, width: incrustada.width, height: incrustada.height })
  } else {
    const imagen =
      d.papel.mime === 'image/png'
        ? await pdf.embedPng(d.papel.bytes)
        : await pdf.embedJpg(d.papel.bytes)
    pagina = pdf.addPage([CARTA.ancho, CARTA.alto])
    pagina.drawImage(imagen, { x: 0, y: 0, width: CARTA.ancho, height: CARTA.alto })
  }

  const { width: ancho, height: alto } = pagina.getSize()
  const izquierda = 20 * MM
  const anchoUtil = ancho - izquierda * 2
  const tinta = rgb(0.1, 0.16, 0.25)
  const suave = rgb(0.36, 0.42, 0.49)

  // El área libre la definió el médico: arriba su membrete, abajo su firma.
  let y = alto - d.papel.margenArriba * MM
  const piso = d.papel.margenAbajo * MM

  const escribir = (
    texto: string,
    opciones: { tamaño?: number; fuente?: typeof normal; color?: typeof tinta; sangria?: number } = {},
  ) => {
    const tamaño = opciones.tamaño ?? 11
    const fuente = opciones.fuente ?? normal
    const sangria = opciones.sangria ?? 0
    const renglones = enRenglones(texto, anchoUtil - sangria, tamaño, (t, s) =>
      fuente.widthOfTextAtSize(t, s),
    )
    for (const renglon of renglones) {
      // Lo que no cabe no se encima sobre la firma: se corta y se dice.
      if (y - tamaño < piso) return false
      pagina.drawText(renglon, {
        x: izquierda + sangria,
        y: y - tamaño,
        size: tamaño,
        font: fuente,
        color: opciones.color ?? tinta,
      })
      y -= tamaño * 1.35
    }
    return true
  }

  escribir(d.paciente, { tamaño: 13, fuente: negrita })
  escribir([d.edad, d.fecha].filter(Boolean).join('   ·   '), { tamaño: 9.5, color: suave })
  y -= 8

  let cupo = true
  for (const m of d.medicamentos) {
    if (!cupo) break
    cupo = escribir(m.medicamento, { tamaño: 12, fuente: negrita })
    const pauta = [m.dosis, m.frecuencia, m.duracion].filter(Boolean).join('   ·   ')
    if (cupo && pauta) cupo = escribir(pauta, { tamaño: 11, sangria: 10 })
    if (cupo && m.indicaciones) {
      cupo = escribir(m.indicaciones, { tamaño: 10, color: suave, sangria: 10 })
    }
    y -= 6
  }

  if (cupo && d.indicacionesGenerales) {
    y -= 4
    escribir('Indicaciones', { tamaño: 10, fuente: negrita, color: suave })
    escribir(d.indicacionesGenerales, { tamaño: 10.5 })
  }

  return pdf.save()
}
