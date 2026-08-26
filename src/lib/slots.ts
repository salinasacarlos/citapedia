/**
 * Cálculo de huecos disponibles.
 *
 * La disponibilidad NO se pre-genera en la base: se calcula restándole al
 * horario semanal las citas ya confirmadas y los bloqueos.
 *
 * Lo delicado es la zona horaria. `availability` guarda horas de pared
 * ("lunes 09:00") sin zona, mientras que las citas son instantes en UTC.
 * Convertir una de la otra requiere saber el desfase de ESE día en ESA zona,
 * que cambia con el horario de verano.
 */

export type Franja = { weekday: number; start_time: string; end_time: string }
export type Intervalo = { starts_at: string; ends_at: string }

export type Hueco = {
  /** Instante de inicio, en ISO/UTC. */
  inicio: string
  fin: string
}

export type DiaConHuecos = {
  /** 'YYYY-MM-DD' en la zona del consultorio. */
  fecha: string
  huecos: Hueco[]
}

/** Desfase de una zona respecto de UTC, en ms, para un instante dado. */
function desfase(ts: number, zona: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(ts)).map((parte) => [parte.type, parte.value]),
  )
  // 'hour' puede venir como '24' a medianoche en algunos entornos.
  const hora = Number(p.hour) % 24
  const comoUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hora,
    Number(p.minute),
    Number(p.second),
  )
  return comoUTC - ts
}

/**
 * "El 3 de marzo a las 09:00 en Ciudad de México" → el instante UTC exacto.
 * Se refina una vez porque el desfase depende del instante que buscamos.
 */
export function horaLocalAInstante(
  año: number,
  mes: number,
  dia: number,
  horas: number,
  minutos: number,
  zona: string,
): Date {
  const tentativo = Date.UTC(año, mes - 1, dia, horas, minutos)
  const d1 = desfase(tentativo, zona)
  let ts = tentativo - d1
  const d2 = desfase(ts, zona)
  if (d2 !== d1) ts = tentativo - d2
  return new Date(ts)
}

/** Partes de la fecha de un instante, vistas desde una zona. */
export function partesEnZona(fecha: Date, zona: string) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const p = Object.fromEntries(
    dtf.formatToParts(fecha).map((parte) => [parte.type, parte.value]),
  )
  const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    año: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    weekday: DIAS[p.weekday as string],
    fecha: `${p.year}-${p.month}-${p.day}`,
  }
}

function aMinutos(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function seEnciman(aIni: number, aFin: number, bIni: number, bFin: number) {
  return aIni < bFin && aFin > bIni
}

export function calcularHuecos({
  disponibilidad,
  bloqueos,
  ocupados,
  duracionMin,
  zona,
  dias = 21,
  desde = new Date(),
  anticipacionMin = 0,
}: {
  disponibilidad: Franja[]
  bloqueos: Intervalo[]
  ocupados: Intervalo[]
  duracionMin: number
  zona: string
  dias?: number
  desde?: Date
  /** Cuánto antes deja de ofrecerse un hueco (minutos). */
  anticipacionMin?: number
}): DiaConHuecos[] {
  const paso = duracionMin * 60_000
  const piso = desde.getTime() + anticipacionMin * 60_000

  const tapados = [...bloqueos, ...ocupados].map((i) => [
    new Date(i.starts_at).getTime(),
    new Date(i.ends_at).getTime(),
  ])

  const resultado: DiaConHuecos[] = []

  for (let n = 0; n < dias; n++) {
    const referencia = new Date(desde.getTime() + n * 86_400_000)
    const { año, mes, dia, weekday, fecha } = partesEnZona(referencia, zona)

    const delDia = disponibilidad.filter((f) => f.weekday === weekday)
    const huecos: Hueco[] = []

    for (const franja of delDia) {
      const iniMin = aMinutos(franja.start_time)
      const finMin = aMinutos(franja.end_time)

      for (let m = iniMin; m + duracionMin <= finMin; m += duracionMin) {
        const inicio = horaLocalAInstante(año, mes, dia, Math.floor(m / 60), m % 60, zona)
        const ini = inicio.getTime()
        const fin = ini + paso

        if (ini < piso) continue
        if (tapados.some(([bIni, bFin]) => seEnciman(ini, fin, bIni, bFin))) continue

        huecos.push({ inicio: inicio.toISOString(), fin: new Date(fin).toISOString() })
      }
    }

    huecos.sort((a, b) => a.inicio.localeCompare(b.inicio))
    if (huecos.length > 0) resultado.push({ fecha, huecos })
  }

  return resultado
}
