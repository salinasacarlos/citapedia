'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ocultarPrimerosPasos } from '@/lib/admin/actions'

export type Paso = {
  titulo: string
  porque: string
  href: string
  accion: string
  hecho: boolean
}

/** Las secciones, en una línea cada una. Sustituye al tour de flechitas. */
const SECCIONES = [
  ['Agenda', 'Lo que sigue y lo que quedó por cerrar.'],
  ['Solicitudes', 'Quien pidió cita y espera tu sí o tu no.'],
  ['Pacientes', 'Sus fichas, su expediente y sus estudios.'],
  ['Horario', 'Tus días y horas, y los bloqueos cuando no estás.'],
  ['Historial', 'Las citas ya cerradas, con filtros y descarga.'],
  ['Mi página', 'Lo que ven tus pacientes antes de agendar.'],
  ['Equipo', 'Invitar a tu asistente y quitarle el acceso.'],
] as const

/**
 * Primeros pasos, no un tour.
 *
 * Un recorrido de flechitas se hace clic para quitárselo de encima y no
 * enseña nada. Esta lista mira el estado real —¿ya hay horario?, ¿ya hay
 * pacientes?— y cada paso se tacha solo cuando de verdad está hecho. Además
 * dice **por qué** importa cada uno: sin el porqué, "publica tu horario" es
 * una tarea; con él, es la razón de que tu liga todavía no sirva.
 */
export function PrimerosPasos({ pasos }: { pasos: Paso[] }) {
  const [oculto, setOculto] = useState(false)
  const hechos = pasos.filter((p) => p.hecho).length
  const siguiente = pasos.find((p) => !p.hecho)

  if (oculto || !siguiente) return null

  return (
    <section className="tarjeta mb-6 border-brand/30 bg-brand-suave/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">Para empezar</h2>
          <p className="mt-0.5 text-sm text-muted">
            {hechos} de {pasos.length} listos. Puedes hacerlos en cualquier orden.
          </p>
        </div>
        <form
          action={ocultarPrimerosPasos}
          onSubmit={() => setOculto(true)}
          className="shrink-0"
        >
          <button className="text-xs text-muted hover:underline">No mostrar más</button>
        </form>
      </div>

      <ol className="mt-4 space-y-2">
        {pasos.map((p) => (
          <li
            key={p.titulo}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-marca px-3 py-2 ${
              p.hecho ? 'opacity-60' : 'bg-surface'
            }`}
          >
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                p.hecho ? 'bg-exito-suave text-exito' : 'border border-border text-muted'
              }`}
            >
              {p.hecho ? '✓' : ''}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${p.hecho ? 'line-through' : 'text-ink'}`}>
                {p.titulo}
              </p>
              {!p.hecho && <p className="text-xs text-muted">{p.porque}</p>}
            </div>
            {!p.hecho && (
              <Link
                href={p.href}
                className="boton boton-suave shrink-0 px-3 py-1.5 text-xs"
              >
                {p.accion}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-acento">
          ¿Qué hay en cada sección?
        </summary>
        <dl className="mt-2 space-y-1.5 text-sm">
          {SECCIONES.map(([nombre, que]) => (
            <div key={nombre} className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-ink">{nombre}</dt>
              <dd className="text-muted">{que}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}
