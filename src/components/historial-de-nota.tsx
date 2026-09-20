import { fechaCorta, hora } from '@/lib/fechas'

export type Version = {
  replaced_at: string
  motivo: string
  autor: string | null
  note: string | null
  diagnosis: string | null
  treatment: string | null
  weight_kg: number | null
  height_cm: number | null
  temperature_c: number | null
  blood_pressure: string | null
  heart_rate: number | null
  oxygen_saturation: number | null
}

/** Lo que se compara: la versión guardada contra lo que vino después. */
export type EstadoDeNota = Omit<Version, 'replaced_at' | 'motivo' | 'autor'>

const CAMPOS: { clave: keyof EstadoDeNota; etiqueta: string; unidad?: string }[] = [
  { clave: 'diagnosis', etiqueta: 'Diagnóstico' },
  { clave: 'treatment', etiqueta: 'Indicaciones' },
  { clave: 'note', etiqueta: 'Nota' },
  { clave: 'weight_kg', etiqueta: 'Peso', unidad: 'kg' },
  { clave: 'height_cm', etiqueta: 'Talla', unidad: 'cm' },
  { clave: 'temperature_c', etiqueta: 'Temperatura', unidad: '°C' },
  { clave: 'blood_pressure', etiqueta: 'Presión arterial' },
  { clave: 'heart_rate', etiqueta: 'Pulso', unidad: 'lpm' },
  { clave: 'oxygen_saturation', etiqueta: 'Saturación', unidad: '%' },
]

function comoTexto(valor: string | number | null, unidad?: string) {
  if (valor === null || valor === '') return null
  return unidad ? `${valor} ${unidad}` : String(valor)
}

/**
 * Lo que decía la nota antes de corregirse.
 *
 * Solo se listan los campos que **de verdad cambiaron** entre esa versión y la
 * siguiente. Antes se listaba la versión entera, así que al agregar la nota de
 * una consulta aparecía el tratamiento tachado como si se hubiera borrado —
 * cuando nadie lo tocó. Un historial que señala lo que no pasó deja de
 * creerse, y con él los renglones que sí importan.
 *
 * Va plegado: lo vigente es la nota de arriba, y esto se consulta cuando
 * alguien pregunta "¿no decía otra cosa?".
 */
export function HistorialDeNota({
  versiones,
  actual,
  zona,
}: {
  versiones: Version[]
  /** La nota como está ahora. Es contra lo que se compara la más reciente. */
  actual: EstadoDeNota | null
  zona: string
}) {
  if (versiones.length === 0) return null

  // Vienen de la más nueva a la más vieja, así que lo que siguió a cada una es
  // la anterior en la lista; para la primera, la nota de hoy.
  const conCambios = versiones.map((v, i) => {
    const despues: EstadoDeNota | null = i === 0 ? actual : versiones[i - 1]
    const cambios = CAMPOS.map(({ clave, etiqueta, unidad }) => {
      const antes = comoTexto(v[clave], unidad)
      const ahora = despues ? comoTexto(despues[clave], unidad) : null
      // Si el campo llegó vacío a esta versión, no se perdió nada suyo.
      if (antes === null || antes === ahora) return null
      return { etiqueta, antes, seVacio: ahora === null }
    }).filter((c) => c !== null)
    return { version: v, cambios }
  })

  return (
    <details className="mt-3 rounded-marca border border-border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-muted">
        Se corrigió {versiones.length} {versiones.length === 1 ? 'vez' : 'veces'} · ver lo
        anterior
      </summary>

      <ol className="mt-3 space-y-3">
        {conCambios.map(({ version: v, cambios }) => (
          <li key={v.replaced_at} className="border-l-2 border-border pl-3 text-sm">
            <p className="text-xs text-muted">
              <span className="first-letter:uppercase">{fechaCorta(v.replaced_at, zona)}</span>{' '}
              {hora(v.replaced_at, zona)}
              {v.motivo === 'delete' ? ' · se borró la nota' : ' · se corrigió'}
              {v.autor && ` · la había escrito ${v.autor}`}
            </p>

            {cambios.length === 0 ? (
              <p className="mt-1 text-xs text-muted">Sin cambios en el texto.</p>
            ) : (
              cambios.map((c) => (
                <p key={c.etiqueta} className="mt-1">
                  <span className="text-xs text-muted">
                    {c.etiqueta}, {c.seVacio ? 'se quitó' : 'antes decía'}:{' '}
                  </span>
                  <span className="line-through decoration-muted/50">{c.antes}</span>
                </p>
              ))
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
