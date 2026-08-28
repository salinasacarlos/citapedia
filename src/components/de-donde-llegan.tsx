import { ORIGENES } from '@/lib/origen'

export type Conteo = { source: string | null; referred_by: string | null }

/**
 * De dónde llegaron los pacientes.
 *
 * Va aquí y no en la ficha porque la pregunta es del consultorio, no de una
 * persona: "¿en qué vale la pena invertir?" y "¿a quién le debo un gracias?".
 * En la ficha individual el dato sirve para otra cosa —saber cómo tratarlo— y
 * ahí ya está.
 */
export function DeDondeLlegan({ pacientes }: { pacientes: Conteo[] }) {
  const conOrigen = pacientes.filter((p) => p.source)
  if (conOrigen.length === 0) return null

  const porOrigen = new Map<string, number>()
  for (const p of conOrigen) {
    porOrigen.set(p.source!, (porOrigen.get(p.source!) ?? 0) + 1)
  }

  // Quién recomienda de verdad: solo cuenta a quien mandó a más de uno.
  const porQuien = new Map<string, number>()
  for (const p of conOrigen) {
    if (!p.referred_by) continue
    const quien = p.referred_by.trim()
    porQuien.set(quien, (porQuien.get(quien) ?? 0) + 1)
  }
  const recomiendan = [...porQuien.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const ordenados = [...porOrigen.entries()].sort((a, b) => b[1] - a[1])
  const mayor = ordenados[0][1]

  return (
    <section className="tarjeta mb-5 p-4 sm:p-5">
      <h2 className="font-semibold text-ink">De dónde llegan</h2>
      <p className="mt-0.5 mb-3 text-sm text-muted">
        {conOrigen.length} de {pacientes.length}{' '}
        {pacientes.length === 1 ? 'paciente contestó' : 'pacientes contestaron'} de
        dónde vienen.
      </p>

      <dl className="space-y-1.5">
        {ordenados.map(([origen, cuantos]) => (
          <div key={origen} className="flex items-center gap-3 text-sm">
            <dt className="w-44 shrink-0 truncate text-muted">
              {ORIGENES.find((o) => o.valor === origen)?.etiqueta ?? origen}
            </dt>
            {/* La barra es para comparar de un vistazo; el número es el dato. */}
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden
                className="h-2 rounded-full bg-brand"
                style={{ width: `${Math.max((cuantos / mayor) * 100, 4)}%` }}
              />
              <span className="tabular-nums text-ink">{cuantos}</span>
            </dd>
          </div>
        ))}
      </dl>

      {recomiendan.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">Quién te manda pacientes</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {recomiendan.map(([quien, cuantos]) => (
              <li key={quien}>
                {quien}{' '}
                <span className="tabular-nums text-muted">
                  ({cuantos})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
