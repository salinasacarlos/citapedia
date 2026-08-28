import { fechaCorta, hora } from '@/lib/fechas'

export type Version = {
  replaced_at: string
  motivo: string
  autor: string | null
  note: string | null
  diagnosis: string | null
  treatment: string | null
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null
  return (
    <p className="mt-1">
      <span className="text-xs text-muted">{etiqueta}: </span>
      <span className="line-through decoration-muted/50">{valor}</span>
    </p>
  )
}

/**
 * Lo que decía la nota antes de corregirse.
 *
 * Va plegado y no a la vista: lo vigente es la nota de arriba, y esto se
 * consulta cuando alguien pregunta "¿no decía otra cosa?". Existe porque un
 * expediente donde lo escrito se reemplaza sin rastro no protege ni al
 * paciente ni al médico.
 */
export function HistorialDeNota({
  versiones,
  zona,
}: {
  versiones: Version[]
  zona: string
}) {
  if (versiones.length === 0) return null

  return (
    <details className="mt-3 rounded-marca border border-border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-muted">
        Se corrigió {versiones.length}{' '}
        {versiones.length === 1 ? 'vez' : 'veces'} · ver lo anterior
      </summary>

      <ol className="mt-3 space-y-3">
        {versiones.map((v) => (
          <li key={v.replaced_at} className="border-l-2 border-border pl-3 text-sm">
            <p className="text-xs text-muted">
              <span className="first-letter:uppercase">
                {fechaCorta(v.replaced_at, zona)}
              </span>{' '}
              {hora(v.replaced_at, zona)}
              {v.motivo === 'delete' ? ' · se borró la nota' : ' · se corrigió'}
              {v.autor && ` · la había escrito ${v.autor}`}
            </p>
            <Campo etiqueta="Diagnóstico" valor={v.diagnosis} />
            <Campo etiqueta="Tratamiento" valor={v.treatment} />
            <Campo etiqueta="Nota" valor={v.note} />
          </li>
        ))}
      </ol>
    </details>
  )
}
