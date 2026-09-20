/**
 * Dónde está libre el papel del médico.
 *
 * Los márgenes por defecto (60 y 40 mm) son una suposición sobre una hoja
 * carta, y cada receta es distinta: media carta, con o sin pie, con la firma
 * más arriba o más abajo. Pedirle al médico que mida con una regla funciona,
 * pero es trabajo que la computadora puede hacer mirando su hoja.
 *
 * La medición vive aparte del decodificador a propósito: es aritmética sobre
 * renglones de píxeles, así que se puede probar sin imágenes de verdad.
 */

/** Un renglón de la hoja: qué tan lleno está de tinta, de 0 a 1. */
export type Renglon = number

/**
 * Proporción de píxeles que se salen del fondo para considerar que un renglón
 * tiene contenido. Un poco de ruido de escaneo no es el membrete.
 */
const UMBRAL_TINTA = 0.015

/** Aire extra para no pegarle al membrete ni a la firma. */
const RESPIRO_MM = 4

export type MargenesMedidos = {
  arriba: number
  abajo: number
  /** Qué tan confiable es: sin una franja libre clara, mejor no presumir. */
  seguro: boolean
}

/**
 * Convierte los renglones con tinta en dos márgenes, en milímetros.
 *
 * La regla: el membrete es lo que está pegado **arriba**, el pie y la firma lo
 * que está pegado **abajo**, y en medio queda el aire. Cualquier cosa suelta
 * en el centro —una marca de agua, una línea— se ignora: si se respetara,
 * no quedaría dónde escribir.
 */
export function medirMargenes(renglones: Renglon[], altoMm: number): MargenesMedidos {
  const total = renglones.length
  if (total === 0) return { arriba: 60, abajo: 40, seguro: false }

  const conTinta = renglones.map((r) => r > UMBRAL_TINTA)
  const porRenglon = altoMm / total

  let primeroLibre = 0
  while (primeroLibre < total && conTinta[primeroLibre]) primeroLibre++

  let ultimoLibre = total - 1
  while (ultimoLibre >= 0 && conTinta[ultimoLibre]) ultimoLibre--

  // Una hoja entera con tinta —un fondo de color, un marco cerrado— no se
  // puede medir así. Mejor devolver lo de siempre y decir que no es seguro.
  if (primeroLibre >= ultimoLibre) return { arriba: 60, abajo: 40, seguro: false }

  const arriba = Math.round(primeroLibre * porRenglon + RESPIRO_MM)
  const abajo = Math.round((total - 1 - ultimoLibre) * porRenglon + RESPIRO_MM)

  // Si entre los dos se comen la hoja, la medición no sirve para escribir.
  const libre = altoMm - arriba - abajo
  if (libre < 20) return { arriba: 60, abajo: 40, seguro: false }

  return {
    arriba: Math.min(arriba, 200),
    abajo: Math.min(abajo, 200),
    // Con menos de dos centímetros de membrete no hay nada que esquivar: lo
    // más probable es que la hoja venga en blanco o casi.
    seguro: primeroLibre * porRenglon > 10,
  }
}

/**
 * Cuánta tinta tiene cada renglón de una imagen en escala de grises.
 *
 * Se ignoran los costados: muchas recetas traen un marco o una franja de color
 * de arriba abajo, y con eso ningún renglón quedaría libre. Lo que importa es
 * el centro, que es donde se escribe.
 */
export function renglonesConTinta(
  gris: Uint8Array | Buffer,
  ancho: number,
  alto: number,
): Renglon[] {
  const desde = Math.floor(ancho * 0.15)
  const hasta = Math.ceil(ancho * 0.85)
  const util = Math.max(1, hasta - desde)

  // El fondo es el tono más común: hay recetas en papel color, y dar por hecho
  // que el fondo es blanco las leería como una hoja llena de tinta.
  const cuenta = new Uint32Array(256)
  for (let i = 0; i < gris.length; i++) cuenta[gris[i]]++
  let fondo = 0
  for (let v = 1; v < 256; v++) if (cuenta[v] > cuenta[fondo]) fondo = v

  const renglones: Renglon[] = []
  for (let y = 0; y < alto; y++) {
    let distintos = 0
    for (let x = desde; x < hasta; x++) {
      if (Math.abs(gris[y * ancho + x] - fondo) > 28) distintos++
    }
    renglones.push(distintos / util)
  }
  return renglones
}
