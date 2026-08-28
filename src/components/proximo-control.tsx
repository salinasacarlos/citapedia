'use client'

import Link from 'next/link'
import { useState } from 'react'

/** Lo que se dice de verdad al terminar una consulta. */
const PLAZOS = [
  { etiqueta: '1 mes', meses: 1 },
  { etiqueta: '3 meses', meses: 3 },
  { etiqueta: '6 meses', meses: 6 },
  { etiqueta: '1 año', meses: 12 },
] as const

function enMeses(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

/**
 * Cuándo debe volver el paciente.
 *
 * "Te veo en tres meses" se dice en casi todas las consultas y hoy vive en la
 * memoria de dos personas, que es donde se pierde. Los botones de plazo están
 * porque nadie va a abrir un calendario y contar noventa días con el paciente
 * enfrente: si cuesta, no se llena, y un campo que no se llena no existe.
 */
export function ProximoControl({
  citaId,
  pacienteId,
  valorInicial,
  motivoInicial,
  yaTieneCita,
}: {
  citaId: string
  pacienteId: string
  valorInicial: string | null
  motivoInicial: string | null
  /** Si ya tiene algo agendado, ofrecer agendar otra vez confunde. */
  yaTieneCita: boolean
}) {
  const [fecha, setFecha] = useState(valorInicial ?? '')
  const [motivo, setMotivo] = useState(motivoInicial ?? '')

  return (
    <div className="mt-3 rounded-marca border border-border bg-surface-2/60 p-3">
      <p className="text-xs font-medium text-muted">¿Cuándo debe volver?</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PLAZOS.map((p) => {
          const cuando = enMeses(p.meses)
          const elegido = fecha === cuando
          return (
            <button
              key={p.etiqueta}
              type="button"
              onClick={() => setFecha(elegido ? '' : cuando)}
              className={`boton px-3 py-1 text-xs ${
                elegido ? 'boton-primario' : 'boton-suave'
              }`}
            >
              {p.etiqueta}
            </button>
          )
        })}
        {fecha && (
          <button
            type="button"
            onClick={() => {
              setFecha('')
              setMotivo('')
            }}
            className="px-2 py-1 text-xs text-muted hover:underline"
          >
            Quitar
          </button>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`fecha-control-${citaId}`} className="block text-xs text-muted">
            O una fecha exacta
          </label>
          <input
            id={`fecha-control-${citaId}`}
            name="follow_up_at"
            type="date"
            value={fecha}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFecha(e.target.value)}
            className="campo mt-1"
          />
        </div>
        {fecha && (
          <div>
            <label htmlFor={`motivo-control-${citaId}`} className="block text-xs text-muted">
              ¿Para qué? <span className="opacity-70">opcional</span>
            </label>
            <input
              id={`motivo-control-${citaId}`}
              name="follow_up_reason"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Control de peso, revisar estudios…"
              className="campo mt-1"
            />
          </div>
        )}
      </div>

      {/* Sin fecha no se manda motivo: un motivo suelto no significa nada. */}
      {!fecha && <input type="hidden" name="follow_up_reason" value="" />}

      {fecha && !yaTieneCita && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            Va a aparecer en la lista de controles pendientes ese día. Si el
            paciente sigue aquí, mejor agéndala ahora:
          </span>
          {/* Guardar primero, o el control se pierde al salir de la pantalla. */}
          <Link
            href={`/admin/agendar?paciente=${pacienteId}`}
            className="boton boton-suave px-3 py-1 text-xs"
          >
            Agendar la siguiente
          </Link>
        </p>
      )}

      {fecha && yaTieneCita && (
        <p className="mt-2 text-xs text-muted">
          Ya tiene una cita agendada hacia adelante, así que no va a aparecer en
          la lista de controles pendientes.
        </p>
      )}
    </div>
  )
}
