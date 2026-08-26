'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { agendarCita, type ResultadoAgendar } from '@/lib/admin/agendar'
import { SelectorHueco, etiquetaDia, etiquetaHora } from '@/components/selector-hueco'
import type { DiaConHuecos } from '@/lib/slots'

const DURACIONES = [15, 20, 30, 45, 60]

export function ElegirHuecoCita({
  pacienteId,
  pacienteNombre,
  zona,
  dias,
  duracion,
}: {
  pacienteId: string
  pacienteNombre: string
  zona: string
  dias: DiaConHuecos[]
  duracion: number
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoAgendar, FormData>(
    agendarCita,
    {},
  )
  const [elegido, setElegido] = useState<{ inicio: string; fecha: string } | null>(null)

  return (
    <div className="space-y-5">
      <div className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted">Paciente</p>
          <p className="font-semibold text-ink">{pacienteNombre}</p>
        </div>
        <Link href="/admin/agendar" className="text-sm text-acento hover:underline">
          Cambiar
        </Link>
      </div>

      {/* La duración cambia qué huecos caben, así que va por URL y el servidor
          los vuelve a calcular. */}
      <div className="tarjeta p-4">
        <p className="text-sm font-medium text-ink">¿Cuánto va a durar?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURACIONES.map((min) => (
            <Link
              key={min}
              href={`/admin/agendar?paciente=${pacienteId}&duracion=${min}`}
              scroll={false}
              aria-current={min === duracion ? 'true' : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition ${
                min === duracion
                  ? 'border-brand bg-brand-vivo text-white'
                  : 'border-border bg-surface hover:border-brand'
              }`}
            >
              {min} min
            </Link>
          ))}
        </div>
      </div>

      {dias.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="font-semibold text-ink">No hay huecos de {duracion} minutos</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Prueba con una duración más corta, o libera espacio en tu horario.
          </p>
        </div>
      ) : !elegido ? (
        <SelectorHueco
          dias={dias}
          zona={zona}
          onElegir={(inicio, fecha) => setElegido({ inicio, fecha })}
        />
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paciente" value={pacienteId} />
          <input type="hidden" name="inicio" value={elegido.inicio} />
          <input type="hidden" name="duracion" value={duracion} />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-brand/30 bg-brand-suave px-4 py-3">
            <div>
              <p className="text-xs font-medium text-brand">Queda para</p>
              <p className="font-semibold text-ink first-letter:uppercase">
                {etiquetaDia(elegido.fecha)} a las {etiquetaHora(elegido.inicio, zona)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setElegido(null)}
              className="text-sm font-medium text-acento hover:underline"
            >
              Cambiar
            </button>
          </div>

          <div className="tarjeta p-4">
            <label htmlFor="notas" className="block text-sm font-medium text-ink">
              Motivo <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={2}
              placeholder="Lo que te dijo por teléfono."
              className="campo mt-1.5 resize-y"
            />
          </div>

          {estado.error && (
            <p
              role="alert"
              className="rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro"
            >
              {estado.error}
            </p>
          )}

          <button disabled={pendiente} className="boton boton-primario w-full py-3 sm:w-auto sm:px-6">
            {pendiente ? 'Agendando…' : 'Agendar y confirmar'}
          </button>
          <p className="text-xs text-muted">
            Queda confirmada de una vez: no pasa por la bandeja de solicitudes.
          </p>
        </form>
      )}
    </div>
  )
}
