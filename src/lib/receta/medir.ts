import 'server-only'
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib'
import { medirMargenes, renglonesConTinta, type MargenesMedidos } from './analizar'
import { papelQueMasSeParece } from './pdf'

/**
 * Mira el papel que subió el médico y propone los márgenes.
 *
 * Lo que se puede medir se mide; lo que no, se dice. Un número propuesto que
 * el médico revisa vale mucho más que un valor por defecto que nadie tocó, y
 * mucho menos que uno inventado con cara de certeza.
 */
export async function medirPapel(
  bytes: Uint8Array,
  mime: string,
): Promise<MargenesMedidos & { alto_mm: number }> {
  const porDefecto = { arriba: 60, abajo: 40, seguro: false, alto_mm: 279 }

  try {
    const { imagen, altoMm } = await comoImagen(bytes, mime)
    if (!imagen) return porDefecto

    const { default: sharp } = await import('sharp')
    const { data, info } = await sharp(Buffer.from(imagen))
      .greyscale()
      // Se reduce antes de medir: con 300 ppp son millones de píxeles para una
      // pregunta que se contesta igual de bien con una miniatura.
      .resize({ width: 600, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const renglones = renglonesConTinta(data, info.width, info.height)
    return { ...medirMargenes(renglones, altoMm), alto_mm: Math.round(altoMm) }
  } catch {
    // Un papel que no se puede leer no debe impedir guardarlo: se queda con
    // los valores de siempre y el médico los ajusta viendo la muestra.
    return porDefecto
  }
}

/** Los bytes de imagen a medir, y cuántos milímetros de alto representan. */
async function comoImagen(
  bytes: Uint8Array,
  mime: string,
): Promise<{ imagen: Uint8Array | null; altoMm: number }> {
  const PT_A_MM = 25.4 / 72

  if (mime !== 'application/pdf') {
    const { default: sharp } = await import('sharp')
    const meta = await sharp(Buffer.from(bytes)).metadata()
    const papel = papelQueMasSeParece(meta.width ?? 1, meta.height ?? 1)
    return { imagen: bytes, altoMm: papel.alto * PT_A_MM }
  }

  // Un PDF hay que dibujarlo para poder mirarlo, y traerse un renderizador
  // entero por esto no se paga. Pero el caso más común es una receta escaneada:
  // una sola imagen dentro de la página. Esa sí se puede sacar y medir.
  const doc = await PDFDocument.load(bytes)
  const pagina = doc.getPage(0)
  const altoMm = pagina.getHeight() * PT_A_MM

  const recursos = pagina.node.Resources()
  const xobjects = recursos?.lookup(PDFName.of('XObject'))
  if (!(xobjects instanceof PDFDict)) return { imagen: null, altoMm }

  for (const clave of xobjects.keys()) {
    const flujo = xobjects.lookup(clave)
    if (!(flujo instanceof PDFRawStream)) continue

    // Solo JPEG: sus bytes dentro del PDF ya son un JPEG completo. Un bitmap
    // comprimido con Flate habría que rearmarlo, y ahí ya no se paga.
    const filtro = flujo.dict.get(PDFName.of('Filter'))
    if (String(filtro).includes('DCTDecode')) {
      return { imagen: flujo.asUint8Array(), altoMm }
    }
  }

  return { imagen: null, altoMm }
}
