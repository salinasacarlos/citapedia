/**
 * Pruebas del cálculo de huecos. Sin base de datos: funciones puras.
 *   npm run test:slots
 */
import {
  calcularHuecos,
  horaLocalAInstante,
  partesEnZona,
  type Franja,
} from '../src/lib/slots'

let fallos = 0
function check(etiqueta: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${etiqueta}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

const MX = 'America/Mexico_City'
const hhmm = (iso: string, zona: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))

console.log('\nConversión de hora local a instante')

// CDMX ya no tiene horario de verano: siempre UTC-6.
check(
  'lunes 09:00 en CDMX es 15:00 UTC',
  horaLocalAInstante(2026, 9, 7, 9, 0, MX).toISOString() === '2026-09-07T15:00:00.000Z',
  horaLocalAInstante(2026, 9, 7, 9, 0, MX).toISOString(),
)

// Madrid sí: CEST (UTC+2) en verano, CET (UTC+1) en invierno.
check(
  'Madrid en verano va a UTC+2',
  horaLocalAInstante(2026, 7, 15, 9, 0, 'Europe/Madrid').toISOString() ===
    '2026-07-15T07:00:00.000Z',
  horaLocalAInstante(2026, 7, 15, 9, 0, 'Europe/Madrid').toISOString(),
)
check(
  'Madrid en invierno va a UTC+1',
  horaLocalAInstante(2026, 1, 15, 9, 0, 'Europe/Madrid').toISOString() ===
    '2026-01-15T08:00:00.000Z',
  horaLocalAInstante(2026, 1, 15, 9, 0, 'Europe/Madrid').toISOString(),
)

check(
  'partesEnZona reconoce el día de la semana',
  partesEnZona(new Date('2026-09-07T15:00:00Z'), MX).weekday === 1,
)

// Un instante que en UTC ya es del día siguiente sigue siendo "hoy" en CDMX.
check(
  'la fecha se lee en la zona del consultorio, no en UTC',
  partesEnZona(new Date('2026-09-08T03:00:00Z'), MX).fecha === '2026-09-07',
  partesEnZona(new Date('2026-09-08T03:00:00Z'), MX).fecha,
)

console.log('\nCálculo de huecos')

// Lunes 7 de septiembre de 2026, 09:00–12:00, citas de 30 min.
const lunes: Franja[] = [{ weekday: 1, start_time: '09:00', end_time: '12:00' }]
const desde = new Date('2026-09-07T14:00:00Z') // 08:00 en CDMX

const base = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde,
})

check('un solo día con huecos', base.length === 1 && base[0].fecha === '2026-09-07')
check('09:00–12:00 en tramos de 30 min da 6 huecos', base[0].huecos.length === 6)
check(
  'el primero es a las 09:00 hora del consultorio',
  hhmm(base[0].huecos[0].inicio, MX) === '09:00',
  hhmm(base[0].huecos[0].inicio, MX),
)
check(
  'el último empieza 11:30 y no se pasa de las 12:00',
  hhmm(base[0].huecos[5].inicio, MX) === '11:30' &&
    hhmm(base[0].huecos[5].fin, MX) === '12:00',
)

// Una cita confirmada tapa su hueco.
const conCita = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [{ starts_at: '2026-09-07T16:00:00Z', ends_at: '2026-09-07T16:30:00Z' }],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde,
})
check('una cita confirmada quita su hueco', conCita[0].huecos.length === 5)
check(
  'el hueco que desaparece es justo el de las 10:00',
  !conCita[0].huecos.some((h) => hhmm(h.inicio, MX) === '10:00'),
)

// Un bloqueo largo se come varios.
const conBloqueo = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [{ starts_at: '2026-09-07T16:00:00Z', ends_at: '2026-09-07T18:00:00Z' }],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde,
})
check('un bloqueo de 2 h se lleva 4 huecos', conBloqueo[0].huecos.length === 2)

// Una cita que solo toca parcialmente también invalida el hueco.
const parcial = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [{ starts_at: '2026-09-07T15:15:00Z', ends_at: '2026-09-07T15:45:00Z' }],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde,
})
check('una cita a caballo invalida los dos huecos que toca', parcial[0].huecos.length === 4)

// Lo que ya pasó no se ofrece.
const tarde = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde: new Date('2026-09-07T16:20:00Z'), // 10:20 en CDMX
})
check('no se ofrecen huecos que ya pasaron', tarde[0].huecos.length === 3)
check(
  'el siguiente ofrecido es el de las 10:30',
  hhmm(tarde[0].huecos[0].inicio, MX) === '10:30',
  hhmm(tarde[0].huecos[0].inicio, MX),
)

// Anticipación mínima: con 2 h de margen desde las 10:20 el piso queda en
// 12:20, y ese día cierra a las 12:00 — no debe quedar nada.
const sinMargen = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde: new Date('2026-09-07T16:20:00Z'),
  anticipacionMin: 120,
})
check('con anticipación de 2 h ese día se queda sin huecos', sinMargen.length === 0)

// Con media hora de margen sí alcanza, pero recorrido.
const conMargen = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 1,
  desde: new Date('2026-09-07T16:20:00Z'),
  anticipacionMin: 30,
})
check(
  'con 30 min de anticipación el primer hueco es el de las 11:00',
  hhmm(conMargen[0].huecos[0].inicio, MX) === '11:00',
  conMargen[0].huecos.map((h) => hhmm(h.inicio, MX)).join(','),
)

// Días sin horario no aparecen.
const semana = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 30,
  zona: MX,
  dias: 14,
  desde,
})
check('en 14 días solo aparecen los dos lunes', semana.length === 2, semana.map((d) => d.fecha).join(', '))

// Duración que no divide la franja: no se ofrece un hueco que se pase.
const cuarenta = calcularHuecos({
  disponibilidad: lunes,
  bloqueos: [],
  ocupados: [],
  duracionMin: 45,
  zona: MX,
  dias: 1,
  desde,
})
check('citas de 45 min en 3 h dan 4 huecos, sin pasarse', cuarenta[0].huecos.length === 4)
check(
  'el último de 45 min termina 12:00 en punto',
  hhmm(cuarenta[0].huecos[3].fin, MX) === '12:00',
  hhmm(cuarenta[0].huecos[3].fin, MX),
)

console.log(fallos === 0 ? '\n✅ Huecos verificados.\n' : `\n❌ ${fallos} falla(s).\n`)
process.exit(fallos === 0 ? 0 : 1)
