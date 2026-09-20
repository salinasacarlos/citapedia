// Dónde está libre el papel del médico: aritmética sobre renglones de
// píxeles, sin imágenes de verdad ni red.
import { medirMargenes, renglonesConTinta } from '../src/lib/receta/analizar'

let fallas = 0
function check(que: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${que}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallas++
}

/** Una hoja de `alto` renglones con tinta arriba y abajo. */
function hoja(alto: number, arriba: number, abajo: number, ruidoCentro = 0): number[] {
  return Array.from({ length: alto }, (_, y) => {
    if (y < arriba || y >= alto - abajo) return 0.4
    return ruidoCentro
  })
}

console.log('\nMedir dónde está libre la hoja')

// Media carta: 140 mm de alto. Membrete de 30 mm, firma de 25 mm.
const m = medirMargenes(hoja(280, 60, 50), 140)
check('encuentra el membrete de arriba', m.arriba >= 30 && m.arriba <= 38, `${m.arriba} mm`)
check('y la firma de abajo', m.abajo >= 25 && m.abajo <= 33, `${m.abajo} mm`)
check('y se declara seguro', m.seguro)

const ruidosa = medirMargenes(hoja(280, 60, 50, 0.008), 140)
check(
  'el ruido de escaneo en el centro no cuenta como membrete',
  Math.abs(ruidosa.arriba - m.arriba) <= 1,
)

const llena = medirMargenes(
  Array.from({ length: 280 }, () => 0.5),
  140,
)
check('una hoja con tinta en todos lados no se inventa márgenes', !llena.seguro)
check('y devuelve los de siempre', llena.arriba === 60 && llena.abajo === 40)

const blanca = medirMargenes(
  Array.from({ length: 280 }, () => 0),
  140,
)
check('una hoja en blanco no se declara segura', !blanca.seguro)

const casiLlena = medirMargenes(hoja(280, 130, 130), 140)
check('si no queda dónde escribir, tampoco', !casiLlena.seguro)

console.log('\nLeer los renglones de una imagen')

// 20x10 con fondo gris claro, una banda oscura en los primeros 3 renglones.
const ancho = 20
const alto = 10
const gris = new Uint8Array(ancho * alto).fill(230)
for (let y = 0; y < 3; y++) for (let x = 0; x < ancho; x++) gris[y * ancho + x] = 20

const renglones = renglonesConTinta(gris, ancho, alto)
check('los renglones con banda salen con tinta', renglones[0] > 0.9 && renglones[2] > 0.9)
check('los libres salen en cero', renglones[5] === 0)

// Un marco lateral no debe ensuciar todos los renglones.
const conMarco = new Uint8Array(ancho * alto).fill(230)
for (let y = 0; y < alto; y++) {
  conMarco[y * ancho] = 0
  conMarco[y * ancho + ancho - 1] = 0
}
const sinMarco = renglonesConTinta(conMarco, ancho, alto)
check('un marco en los costados se ignora', sinMarco.every((r) => r === 0))

// Fondo de color: no se asume blanco.
const colorido = new Uint8Array(ancho * alto).fill(120)
for (let y = 0; y < 2; y++) for (let x = 0; x < ancho; x++) colorido[y * ancho + x] = 250
const enColor = renglonesConTinta(colorido, ancho, alto)
check('un papel de color no se lee como hoja llena de tinta', enColor[5] === 0)
check('y lo impreso encima sí se ve', enColor[0] > 0.9)

console.log(fallas === 0 ? '\n✅ Medición verificada.' : `\n❌ ${fallas} fallas.`)
process.exit(fallas === 0 ? 0 : 1)
