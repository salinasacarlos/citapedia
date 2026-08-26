import { horaLocalAInstante, partesEnZona } from '@/lib/slots'
import type { AppointmentStatus } from '@/lib/database.types'

/**
 * Geometría de la vista de calendario.
 *
 * Todo se calcula en "minutos desde la medianoche local" del día que se está
 * pintando. Las citas se guardan en UTC, así que el ancla de cada día es el
 * instante de su medianoche en la zona del consultorio: eso mantiene la
 * rejilla correcta aunque cambie el horario de verano.
 */

export type Evento = {
  id: string
  inicio: string
  fin: string
  titulo: string
  tipo: 'cita' | 'bloqueo'
  estado?: AppointmentStatus
  detalle?: string | null
}

export type EventoPuesto = Evento & {
  /** Minutos desde la medianoche local, ya recortados a la ventana visible. */
  desdeMin: number
  hastaMin: number
  /** Reparto horizontal cuando varios se enciman. */
  carril: number
  carriles: number
}

export type Banda = { desdeMin: number; hastaMin: number }

const DIA_EN_MS = 86_400_000

/** 'YYYY-MM-DD' + n días, sin que la zona del servidor se meta. */
export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d) + n * DIA_EN_MS)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`
}

/** 0 = domingo … 6 = sábado, para una fecha local. */
export function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

export function hoyEnZona(zona: string): string {
  return partesEnZona(new Date(), zona).fecha
}

/** Los siete días de la semana (lunes a domingo) que contiene esa fecha. */
export function semanaDe(fecha: string): string[] {
  const dow = diaDeLaSemana(fecha)
  const lunes = sumarDias(fecha, dow === 0 ? -6 : 1 - dow)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

export function medianocheDe(fecha: string, zona: string): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  return horaLocalAInstante(a, m, d, 0, 0, zona)
}

export function minutosDeTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function etiquetaHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, h)))
}

/**
 * Ventana de horas que vale la pena dibujar.
 *
 * Pintar de 00:00 a 24:00 deja la pantalla casi vacía. Se toma el horario que
 * el médico publicó y se estira lo necesario para que ningún evento quede
 * fuera de cuadro.
 */
export function ventanaVisible(
  franjas: { start_time: string; end_time: string }[],
  eventos: EventoPuesto[],
): { desdeMin: number; hastaMin: number } {
  let desde = franjas.length ? Math.min(...franjas.map((f) => minutosDeTime(f.start_time))) : 8 * 60
  let hasta = franjas.length ? Math.max(...franjas.map((f) => minutosDeTime(f.end_time))) : 20 * 60

  for (const e of eventos) {
    desde = Math.min(desde, e.desdeMin)
    hasta = Math.max(hasta, e.hastaMin)
  }

  // A horas cerradas, con un respiro arriba y abajo.
  desde = Math.max(0, Math.floor(desde / 60) * 60 - 60)
  hasta = Math.min(24 * 60, Math.ceil(hasta / 60) * 60 + 60)

  // Una ventana muy angosta se ve rara; mínimo seis horas.
  if (hasta - desde < 360) hasta = Math.min(24 * 60, desde + 360)

  return { desdeMin: desde, hastaMin: hasta }
}

/**
 * Coloca los eventos de un día concreto: minutos locales y reparto en
 * carriles cuando se enciman (dos solicitudes por el mismo hueco, por ejemplo).
 */
export function colocarEnDia(eventos: Evento[], fecha: string, zona: string): EventoPuesto[] {
  const medianoche = medianocheDe(fecha, zona).getTime()
  const finDelDia = medianocheDe(sumarDias(fecha, 1), zona).getTime()

  const delDia = eventos
    .map((e) => {
      const ini = new Date(e.inicio).getTime()
      const fin = new Date(e.fin).getTime()
      if (fin <= medianoche || ini >= finDelDia) return null
      return {
        ...e,
        // Un bloqueo de varios días se recorta a este día.
        desdeMin: Math.max(0, Math.round((ini - medianoche) / 60_000)),
        hastaMin: Math.min(1440, Math.round((fin - medianoche) / 60_000)),
        carril: 0,
        carriles: 1,
      }
    })
    .filter((e): e is EventoPuesto => e !== null)
    .sort((a, b) => a.desdeMin - b.desdeMin || a.hastaMin - b.hastaMin)

  repartirCarriles(delDia)
  return delDia
}

/**
 * Reparte en columnas los eventos que se enciman. Se agrupan en racimos —
 * eventos encadenados por solapamiento — y dentro de cada racimo se busca el
 * primer carril libre.
 */
function repartirCarriles(eventos: EventoPuesto[]) {
  let racimo: EventoPuesto[] = []
  let finDelRacimo = -1

  const cerrar = () => {
    const carriles = racimo.reduce((max, e) => Math.max(max, e.carril + 1), 0)
    for (const e of racimo) e.carriles = carriles
    racimo = []
  }

  for (const evento of eventos) {
    if (evento.desdeMin >= finDelRacimo && racimo.length > 0) cerrar()

    const ocupados = new Set(
      racimo.filter((e) => e.hastaMin > evento.desdeMin).map((e) => e.carril),
    )
    let carril = 0
    while (ocupados.has(carril)) carril++
    evento.carril = carril

    racimo.push(evento)
    finDelRacimo = Math.max(finDelRacimo, evento.hastaMin)
  }
  if (racimo.length > 0) cerrar()
}

/** Minutos transcurridos hoy en la zona del consultorio. */
export function minutosAhora(zona: string): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .split(':')
    .map(Number)
  return h * 60 + m
}

/** Bandas de atención de un día, para pintar el fondo. */
export function bandasDelDia(
  franjas: { weekday: number; start_time: string; end_time: string }[],
  fecha: string,
): Banda[] {
  const dow = diaDeLaSemana(fecha)
  return franjas
    .filter((f) => f.weekday === dow)
    .map((f) => ({ desdeMin: minutosDeTime(f.start_time), hastaMin: minutosDeTime(f.end_time) }))
    .sort((a, b) => a.desdeMin - b.desdeMin)
}
