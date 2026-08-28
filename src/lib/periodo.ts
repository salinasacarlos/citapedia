import { inicioDelDia, finDelDia } from '@/lib/filtros'
import { fechaSuelta } from '@/lib/fechas'

/**
 * El periodo que mira Inicio.
 *
 * Vive en la URL como el resto de los filtros: así un corte se comparte tal
 * cual y el botón atrás funciona. Los presets son los que un consultorio de
 * verdad compara —el mes, el trimestre, el año— y "personalizado" existe
 * porque tarde o temprano alguien quiere justo la temporada de gripas.
 */
export const PERIODOS = [
  { valor: '30', etiqueta: 'Últimos 30 días', dias: 30 },
  { valor: '90', etiqueta: 'Últimos 3 meses', dias: 90 },
  { valor: '365', etiqueta: 'Último año', dias: 365 },
] as const

export type Periodo = {
  clave: string
  etiqueta: string
  desde: string
  hasta: string
  desdeFecha: string
  hastaFecha: string
}

type Params = Record<string, string | string[] | undefined>

function texto(params: Params, clave: string): string {
  const v = params[clave]
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
}

export function leerPeriodo(params: Params, zona: string): Periodo {
  const desdeFecha = texto(params, 'desde')
  const hastaFecha = texto(params, 'hasta')

  // Un rango a mano gana sobre el preset: es más específico por definición.
  if (desdeFecha && hastaFecha) {
    return {
      clave: 'personalizado',
      // En español y no en ISO: esto se lee en un encabezado, no en un log.
      etiqueta: `Del ${fechaSuelta(desdeFecha)} al ${fechaSuelta(hastaFecha)}`,
      desde: inicioDelDia(desdeFecha, zona),
      hasta: finDelDia(hastaFecha, zona),
      desdeFecha,
      hastaFecha,
    }
  }

  const clave = texto(params, 'periodo') || '30'
  const preset = PERIODOS.find((p) => p.valor === clave) ?? PERIODOS[0]
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - preset.dias * 86_400_000)

  return {
    clave: preset.valor,
    etiqueta: preset.etiqueta,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    desdeFecha: desde.toISOString().slice(0, 10),
    hastaFecha: hasta.toISOString().slice(0, 10),
  }
}
