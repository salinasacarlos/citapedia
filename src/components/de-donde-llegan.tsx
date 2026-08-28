import { ORIGENES } from '@/lib/origen'

export type PorOrigen = { source: string; cuantos: number }
export type Recomendante = { quien: string; cuantos: number }

/**
 * De dónde llegaron los pacientes.
 *
 * Va aquí y no en la ficha porque la pregunta es del consultorio, no de una
 * persona: "¿en qué vale la pena invertir?" y "¿a quién le debo un gracias?".
 * En la ficha individual el dato sirve para otra cosa —saber cómo tratarlo— y
 * ahí ya está.
 */
/**
 * Los conteos llegan ya agrupados desde la base.
 *
 * Antes esto recibía la lista entera de pacientes y contaba en JavaScript: con
 * cinco mil pacientes eran cinco mil renglones viajando en cada carga para
 * acabar mostrando ocho números.
 */
export function DeDondeLlegan({
  porOrigen,
  recomiendan,
  conOrigen,
  total,
}: {
  porOrigen: PorOrigen[]
  recomiendan: Recomendante[]
  conOrigen: number
  total: number
}) {
  if (porOrigen.length === 0) return null
  const mayor = porOrigen[0].cuantos

  return (
    <section className="tarjeta mb-5 p-4 sm:p-5">
      <h2 className="font-semibold text-ink">De dónde llegan</h2>
      <p className="mt-0.5 mb-3 text-sm text-muted">
        {conOrigen} de {total} {total === 1 ? 'paciente contestó' : 'pacientes contestaron'}{' '}
        de dónde vienen.
      </p>

      <dl className="space-y-1.5">
        {porOrigen.map(({ source, cuantos }) => (
          <div key={source} className="flex items-center gap-3 text-sm">
            <dt className="w-44 shrink-0 truncate text-muted">
              {ORIGENES.find((o) => o.valor === source)?.etiqueta ?? source}
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
            {recomiendan.map(({ quien, cuantos }) => (
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
