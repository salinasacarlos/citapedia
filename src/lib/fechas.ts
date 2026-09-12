/**
 * Formato de fechas en la zona del consultorio.
 *
 * Todo se guarda en UTC; "las 9:00" siempre significa las 9:00 de donde está
 * el consultorio, no las del navegador de quien mira.
 */

export const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

/** Orden de la semana laboral: lunes primero, domingo al final. */
export const SEMANA = [1, 2, 3, 4, 5, 6, 0] as const

export function fechaLarga(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(iso))
}

export function fechaCorta(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(iso))
}

export function hora(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(iso))
}

export function rangoHorario(desdeISO: string, hastaISO: string, timeZone: string) {
  return `${hora(desdeISO, timeZone)} – ${hora(hastaISO, timeZone)}`
}

/** '30 min', '1 h', '1 h 30 min' — más útil que repetir la hora de fin. */
export function duracion(desdeISO: string, hastaISO: string) {
  const minutos = Math.round(
    (new Date(hastaISO).getTime() - new Date(desdeISO).getTime()) / 60_000,
  )
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/**
 * '09:00:00' → '9:00 a.m.'
 *
 * Un `time` de Postgres no trae zona: ya está expresado en la hora del
 * consultorio. Se arma y se imprime en UTC para que el formateo no le sume
 * el desfase del servidor y termine mostrando otra hora.
 */
export function horaSuelta(time: string) {
  const [h, m] = time.split(':').map(Number)
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

/** "hace 2 días", "en 3 horas" — para saber qué tan urgente es una solicitud. */
export function relativo(iso: string) {
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })
  const diff = new Date(iso).getTime() - Date.now()
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unidad, ms] of unidades) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unidad)
  }
  return 'ahora'
}

/** 'Dra. Mariana Cordero' → 'Mariana'. Para hablarle de tú al lector. */
export function nombreDePila(nombre: string) {
  return nombre.replace(/^(dr|dra|lic|mtro|mtra)\.?\s*/i, '').split(' ')[0]
}

/**
 * "jueves 3 de septiembre, 11:00 a.m. – 1:00 p.m." o, si abarca días
 * completos, "del 3 al 7 de septiembre".
 */
export function describirBloqueo(desdeISO: string, hastaISO: string, zona: string) {
  const inicio = new Date(desdeISO)
  const fin = new Date(hastaISO)

  const dia = (d: Date) =>
    new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: zona,
    }).format(d)

  const soloFecha = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: zona,
    }).format(d)

  const esMedianoche = (d: Date) => hora(d.toISOString(), zona).startsWith('12:00 a')

  // Días completos: no tiene caso decir "de 12:00 a.m. a 12:00 a.m.".
  if (esMedianoche(inicio) && esMedianoche(fin)) {
    // El fin es exclusivo: el último día bloqueado es el anterior.
    const ultimo = new Date(fin.getTime() - 60_000)
    return soloFecha(inicio) === soloFecha(ultimo)
      ? `${dia(inicio)}, todo el día`
      : `de ${dia(inicio)} a ${dia(ultimo)}`
  }

  return soloFecha(inicio) === soloFecha(fin)
    ? `${dia(inicio)}, ${hora(desdeISO, zona)} – ${hora(hastaISO, zona)}`
    : `${dia(inicio)} ${hora(desdeISO, zona)} – ${dia(fin)} ${hora(hastaISO, zona)}`
}

/**
 * '2021-06-18' → '5 años'. En bebés los meses importan más que los años, y
 * en pediatría esa diferencia cambia dosis y percentiles.
 */
export function edad(fechaNacimiento: string | null): string | null {
  if (!fechaNacimiento) return null

  const nace = new Date(`${fechaNacimiento}T12:00:00Z`)
  const hoy = new Date()
  let meses =
    (hoy.getUTCFullYear() - nace.getUTCFullYear()) * 12 +
    (hoy.getUTCMonth() - nace.getUTCMonth())
  if (hoy.getUTCDate() < nace.getUTCDate()) meses--
  if (meses < 0) return null

  if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const años = Math.floor(meses / 12)
  return `${años} ${años === 1 ? 'año' : 'años'}`
}

/** '2021-06-18' → '18 de junio de 2021'. */
export function fechaSuelta(fecha: string | null): string | null {
  if (!fecha) return null
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00Z`))
}

/**
 * La ventana de "por cerrar": desde hace 30 días hasta ahora.
 *
 * Vive aquí y no dentro de la página porque el linter de React marca `Date.now`
 * como impuro en el cuerpo de un componente. En un Server Component que corre
 * una vez por petición no es un problema real, pero darle nombre al concepto
 * sirve igual: más atrás de 30 días ya es historial, no un pendiente.
 */
export function ventanaPorCerrar() {
  const ahora = Date.now()
  return {
    ahora: new Date(ahora).toISOString(),
    desde: new Date(ahora - 30 * 86_400_000).toISOString(),
  }
}
