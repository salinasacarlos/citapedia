'use client'

import { useActionState, useState } from 'react'
import {
  aplicarPlantilla,
  cancelarAviso,
  crearAviso,
  marcarAvisoEnviado,
  type ResultadoAviso,
} from '@/lib/avisos/actions'
import { fechaSuelta } from '@/lib/fechas'

export type Aviso = {
  id: string
  due_on: string
  titulo: string
  mensaje: string | null
  status: 'pendiente' | 'enviado' | 'cancelado'
}

/** Los plazos que se dicen de verdad, medidos desde hoy. */
const PLAZOS = [
  { etiqueta: '3 meses', meses: 3 },
  { etiqueta: '6 meses', meses: 6 },
  { etiqueta: '1 año', meses: 12 },
] as const

function enMeses(meses: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

/**
 * Avisos programados de un paciente.
 *
 * Es lo que permite "a los seis meses le tocan vacunas" sin inventarle una
 * cita: el aviso cuelga del paciente y su fecha se elige.
 */
export type PlantillaAplicable = {
  id: string
  titulo: string
  base: string
  offset_meses: number
  /** Qué día caería para ESTE paciente. Null si no se puede calcular. */
  cuando: string | null
}

export function AvisosDelPaciente({
  pacienteId,
  avisos,
  plantillas = [],
}: {
  pacienteId: string
  avisos: Aviso[]
  plantillas?: PlantillaAplicable[]
}) {
  const [estadoPlantilla, aplicarAction] = useActionState<ResultadoAviso, FormData>(
    aplicarPlantilla,
    {},
  )
  const [estado, formAction, pendiente] = useActionState<ResultadoAviso, FormData>(
    crearAviso,
    {},
  )
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState('')

  const pendientes = avisos.filter((a) => a.status === 'pendiente')
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Avisos programados</h2>
          <p className="text-sm text-muted">
            Para recordarle algo en una fecha, aunque no tenga cita.
          </p>
        </div>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="boton boton-suave px-3 py-1.5 text-xs"
          >
            Programar un aviso
          </button>
        )}
      </div>

      {/*
        Las plantillas del consultorio, con la fecha que le tocaría a ESTE
        paciente ya calculada. Sin la fecha a la vista, aplicar una es una
        apuesta: "a los 6 meses" no dice nada hasta saber que eso cae en marzo.
      */}
      {plantillas.length > 0 && !abierto && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-muted">De tus avisos repetidos</p>
          <div className="flex flex-wrap gap-1.5">
            {plantillas.map((p) => {
              const pasada = p.cuando !== null && p.cuando < hoy
              const motivo = !p.cuando
                ? 'A este paciente le falta la fecha desde la que se cuenta'
                : pasada
                  ? `Esa fecha ya pasó (${fechaSuelta(p.cuando)})`
                  : undefined

              return (
                <form key={p.id} action={aplicarAction}>
                  <input type="hidden" name="patient_id" value={pacienteId} />
                  <input type="hidden" name="plantilla" value={p.id} />
                  <button
                    disabled={Boolean(motivo)}
                    title={motivo ?? `Se programa para el ${fechaSuelta(p.cuando!)}`}
                    className="rounded-full border border-border px-2.5 py-1 text-xs transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {p.titulo}
                    {p.cuando && !pasada && (
                      <span className="ml-1.5 text-muted">{fechaSuelta(p.cuando)}</span>
                    )}
                  </button>
                </form>
              )
            })}
          </div>
          {estadoPlantilla.error && (
            <p role="alert" className="mt-1.5 text-xs text-peligro">
              {estadoPlantilla.error}
            </p>
          )}
        </div>
      )}

      {abierto && (
        <form
          action={(datos) => {
            formAction(datos)
            setAbierto(false)
            setFecha('')
          }}
          className="tarjeta mb-3 p-4"
        >
          <input type="hidden" name="patient_id" value={pacienteId} />

          <label htmlFor="titulo-aviso" className="block text-xs font-medium text-muted">
            ¿De qué se trata?
          </label>
          <input
            id="titulo-aviso"
            name="titulo"
            required
            placeholder="Vacuna de los 6 meses, revisión anual…"
            className="campo mt-1"
          />

          <label htmlFor="mensaje-aviso" className="mt-3 block text-xs font-medium text-muted">
            Qué decirle <span className="opacity-70">opcional</span>
          </label>
          <textarea
            id="mensaje-aviso"
            name="mensaje"
            rows={2}
            placeholder="Es momento de la siguiente dosis. ¿Te agendamos?"
            className="campo mt-1 resize-y"
          />

          <p className="mt-3 text-xs font-medium text-muted">¿Cuándo?</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {PLAZOS.map((p) => {
              const cuando = enMeses(p.meses)
              return (
                <button
                  key={p.etiqueta}
                  type="button"
                  onClick={() => setFecha(fecha === cuando ? '' : cuando)}
                  className={`boton px-3 py-1 text-xs ${
                    fecha === cuando ? 'boton-primario' : 'boton-suave'
                  }`}
                >
                  {p.etiqueta}
                </button>
              )
            })}
            <input
              name="due_on"
              type="date"
              required
              value={fecha}
              min={hoy}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del aviso"
              className="campo w-auto"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={pendiente} className="boton boton-primario px-3 py-1.5 text-xs">
              {pendiente ? 'Guardando…' : 'Programar'}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="boton boton-suave px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {estado.error && (
        <p role="alert" className="mb-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      {pendientes.length === 0 ? (
        <p className="text-sm text-muted">No tiene avisos programados.</p>
      ) : (
        <ul className="space-y-2">
          {pendientes.map((a) => (
            <li
              key={a.id}
              className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{a.titulo}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <span className={a.due_on <= hoy ? 'font-medium text-alerta' : ''}>
                    {a.due_on <= hoy ? 'Tocaba ' : 'Le toca '}
                    {fechaSuelta(a.due_on)}
                  </span>
                </p>
                {a.mensaje && <p className="mt-1 text-sm text-muted">{a.mensaje}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={marcarAvisoEnviado}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="patient_id" value={pacienteId} />
                  <button className="boton boton-suave px-3 py-1.5 text-xs">
                    Ya le avisé
                  </button>
                </form>
                <form action={cancelarAviso}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="patient_id" value={pacienteId} />
                  <button className="text-xs text-muted hover:underline">Ya no aplica</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
