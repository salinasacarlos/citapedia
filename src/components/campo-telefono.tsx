'use client'

import { useState } from 'react'
import {
  LADAS,
  LADAS_FRECUENTES,
  LADA_MEXICO,
  componerTelefono,
  digitosDe,
  revisarTelefono,
  separarTelefono,
} from '@/lib/telefonos'

/**
 * Teléfono con lada explícita.
 *
 * Adivinar el país a partir del largo funciona hasta el primer número de
 * Estados Unidos —también diez dígitos— y entonces el recordatorio se va a un
 * desconocido en Guadalajara. Aquí se pregunta.
 *
 * El campo pide el número nacional, sin lada: es como la gente se lo sabe.
 */
export function CampoTelefono({
  name,
  label,
  valorInicial,
  requerido = false,
  ayuda,
}: {
  name: string
  label: string
  valorInicial?: string | null
  requerido?: boolean
  ayuda?: string
}) {
  const inicial = separarTelefono(valorInicial)
  const [lada, setLada] = useState(inicial.lada || LADA_MEXICO)
  const [numero, setNumero] = useState(inicial.numero.replace(/\D/g, ''))

  const esperados = digitosDe(lada)
  const problema = revisarTelefono(lada, numero)
  const compuesto = componerTelefono(lada, numero) ?? ''

  /**
   * Solo se bloquea el envío en los países que veo todos los días y de cuyo
   * formato estoy seguro. En el resto se avisa pero se deja pasar: equivocarme
   * sobre el largo de un país lejano no puede dejar a alguien sin poder
   * agendar.
   */
  const exigirLargo = LADAS_FRECUENTES.some((l) => l.codigo === lada) && esperados

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
      </label>

      <div className="mt-1.5 flex gap-2">
        <select
          value={lada}
          onChange={(e) => setLada(e.target.value)}
          aria-label={`Lada de ${label}`}
          className="campo w-28 shrink-0 tabular-nums"
        >
          <optgroup label="Frecuentes">
            {LADAS_FRECUENTES.map((l) => (
              <option key={`f-${l.codigo}-${l.pais}`} value={l.codigo}>
                {l.bandera} +{l.codigo}
              </option>
            ))}
          </optgroup>
          <optgroup label="Todos los países">
            {LADAS.map((l) => (
              <option key={`${l.codigo}-${l.pais}`} value={l.codigo}>
                {l.bandera} +{l.codigo} · {l.pais}
              </option>
            ))}
          </optgroup>
        </select>

        <input
          id={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={requerido}
          value={numero}
          maxLength={esperados ?? 14}
          pattern={exigirLargo ? `\\d{${esperados}}` : undefined}
          title={
            exigirLargo ? `Escribe los ${esperados} dígitos, sin la lada.` : undefined
          }
          aria-invalid={problema ? true : undefined}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
          placeholder={esperados ? '0'.repeat(esperados) : 'Número'}
          aria-describedby={`${name}-ayuda`}
          className="campo min-w-0 flex-1 tabular-nums"
        />
      </div>

      {/* Lo que viaja al servidor ya lleva la lada pegada. */}
      <input type="hidden" name={name} value={compuesto} />

      <p id={`${name}-ayuda`} className="mt-1 text-xs text-muted">
        {problema ? (
          <span className="text-peligro">{problema}</span>
        ) : (
          (ayuda ??
            (esperados
              ? `${esperados} dígitos, sin la lada del país.`
              : 'Sin la lada del país.'))
        )}
      </p>
    </div>
  )
}
