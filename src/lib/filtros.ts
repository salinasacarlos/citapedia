import { horaLocalAInstante } from '@/lib/slots'
import type { AppointmentStatus } from '@/lib/database.types'

/**
 * Filtros de las listas de citas.
 *
 * Viven en la URL, no en estado del cliente: así una búsqueda se puede
 * compartir o guardar, el botón atrás funciona, y el filtrado ocurre en la
 * base en vez de traerse todo al navegador.
 */
export type Filtros = {
  q: string
  desde: string
  hasta: string
  estado: string
  pagina: number
}

export const POR_PAGINA = 25

/** Next entrega los searchParams como valores sueltos o arreglos. */
type Params = Record<string, string | string[] | undefined>

function texto(params: Params, clave: string): string {
  const valor = params[clave]
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? ''
}

export function leerFiltros(params: Params): Filtros {
  const pagina = Number(texto(params, 'pagina'))
  return {
    q: texto(params, 'q'),
    desde: texto(params, 'desde'),
    hasta: texto(params, 'hasta'),
    estado: texto(params, 'estado'),
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : 1,
  }
}

export function hayFiltros(f: Filtros): boolean {
  return Boolean(f.q || f.desde || f.hasta || f.estado)
}

/** 'YYYY-MM-DD' del consultorio → instante UTC del inicio de ese día. */
export function inicioDelDia(fecha: string, zona: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return horaLocalAInstante(a, m, d, 0, 0, zona).toISOString()
}

/** El final es exclusivo: 'hasta' incluye el día completo. */
export function finDelDia(fecha: string, zona: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const siguiente = new Date(Date.UTC(a, m - 1, d + 1))
  return horaLocalAInstante(
    siguiente.getUTCFullYear(),
    siguiente.getUTCMonth() + 1,
    siguiente.getUTCDate(),
    0,
    0,
    zona,
  ).toISOString()
}

type Consulta = {
  or: (filtro: string, opciones: { referencedTable: string }) => Consulta
  gte: (columna: string, valor: string) => Consulta
  lt: (columna: string, valor: string) => Consulta
  in: (columna: string, valores: string[]) => Consulta
  eq: (columna: string, valor: string) => Consulta
}

/**
 * Aplica los filtros a una consulta de citas. La búsqueda por texto mira
 * nombre, teléfono y correo del paciente: quien busca no siempre recuerda
 * cuál de los tres tiene a la mano.
 */
export function aplicarFiltros<T extends Consulta>(
  consulta: T,
  filtros: Filtros,
  zona: string,
  estadosPorDefecto: AppointmentStatus[],
): T {
  let q = consulta

  if (filtros.q) {
    // El comodín de PostgREST necesita '*'; los signos que rompen el filtro se quitan.
    const termino = filtros.q.replace(/[,()*]/g, '')
    q = q.or(`name.ilike.*${termino}*,phone.ilike.*${termino}*,email.ilike.*${termino}*`, {
      referencedTable: 'patients',
    }) as T
  }

  if (filtros.desde) q = q.gte('starts_at', inicioDelDia(filtros.desde, zona)) as T
  if (filtros.hasta) q = q.lt('starts_at', finDelDia(filtros.hasta, zona)) as T

  q = (
    filtros.estado
      ? q.eq('status', filtros.estado)
      : q.in('status', estadosPorDefecto)
  ) as T

  return q
}
