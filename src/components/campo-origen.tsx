'use client'

import { useState } from 'react'
import { ORIGENES, pideQuien } from '@/lib/origen'

/**
 * Cómo llegó el paciente, y a quién agradecerle si alguien lo mandó.
 *
 * La pregunta de seguimiento solo aparece cuando aplica: preguntar "¿quién?"
 * a alguien que llegó por Google es ruido, y un campo que casi siempre sobra
 * es un campo que se deja vacío también cuando importa.
 */
export function CampoOrigen({
  label = '¿Cómo llegó contigo?',
  valorInicial = '',
  referidoInicial = '',
  incluirRecurrente = false,
}: {
  label?: string
  valorInicial?: string
  referidoInicial?: string
  /** Solo tiene sentido preguntándole al paciente, no capturando su ficha. */
  incluirRecurrente?: boolean
}) {
  const [origen, setOrigen] = useState(valorInicial)
  const pregunta = pideQuien(origen)

  const opciones = ORIGENES.filter((o) => incluirRecurrente || o.valor !== 'recurrente')

  return (
    <>
      <div>
        <label htmlFor="source" className="block text-sm font-medium text-ink">
          {label} <span className="font-normal text-muted">opcional</span>
        </label>
        <select
          id="source"
          name="source"
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          className="campo mt-1.5"
        >
          <option value="">Prefiero no decir</option>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {pregunta && (
        <div>
          <label htmlFor="referred_by" className="block text-sm font-medium text-ink">
            {pregunta}
          </label>
          <input
            id="referred_by"
            name="referred_by"
            defaultValue={referidoInicial}
            placeholder="Nombre"
            className="campo mt-1.5"
          />
        </div>
      )}
      {/* Sin la pregunta a la vista, no se arrastra un nombre que ya no aplica. */}
      {!pregunta && <input type="hidden" name="referred_by" value="" />}
    </>
  )
}
