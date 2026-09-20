import { fechaSuelta } from '@/lib/fechas'
import type { Receta } from '@/components/recetas'

/**
 * Lo que este consultorio le ha recetado.
 *
 * Es distinto de `clinical_records.medications`, que es lo que el paciente
 * dice que toma. Uno es lo que el médico indicó y cuándo; el otro, lo que trae
 * de su vida. Mezclarlos haría imposible saber quién recetó qué.
 *
 * Solo se lista, no se edita: recetar es un acto de la consulta y su lugar es
 * el workspace, con el paciente enfrente.
 */
export function RecetasDelPaciente({ recetas }: { recetas: Receta[] }) {
  if (recetas.length === 0) return null

  const vigentes = recetas.filter((r) => !r.retirada)
  const retiradas = recetas.filter((r) => r.retirada)

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Lo que le has recetado</h2>
      <p className="mt-1 text-sm text-muted">
        De sus consultas aquí. Lo que toma por su cuenta va en el expediente.
      </p>

      {vigentes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nada vigente.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {vigentes.map((r) => (
            <li key={r.id}>
              <p className="text-sm font-medium text-ink">{r.medicamento}</p>
              <p className="text-xs text-muted">
                {[r.dosis, r.frecuencia, r.duracion].filter(Boolean).join(' · ')}
                {[r.dosis, r.frecuencia, r.duracion].some(Boolean) && ' · '}
                {fechaSuelta(r.cuando.slice(0, 10))}
              </p>
              {r.indicaciones && <p className="text-xs text-muted">{r.indicaciones}</p>}
            </li>
          ))}
        </ul>
      )}

      {retiradas.length > 0 && (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer text-xs text-muted">
            {retiradas.length} retirado{retiradas.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 space-y-1">
            {retiradas.map((r) => (
              <li key={r.id} className="text-xs text-muted line-through">
                {r.medicamento}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
