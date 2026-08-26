'use client'

import { useActionState, useState } from 'react'
import { solicitarCita, type EstadoReserva } from '@/lib/publico/actions'
import type { DiaConHuecos } from '@/lib/slots'

function etiquetaDia(fecha: string, zona: string) {
  // 'YYYY-MM-DD' se interpreta a mediodía UTC para que ninguna zona lo corra
  // al día anterior.
  const d = new Date(`${fecha}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: zona,
  }).format(d)
}

function etiquetaHora(iso: string, zona: string) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zona,
  }).format(new Date(iso))
}

export function Reservar({
  slug,
  medico,
  zona,
  dias,
}: {
  slug: string
  medico: string
  zona: string
  dias: DiaConHuecos[]
}) {
  const [estado, formAction, pendiente] = useActionState<EstadoReserva, FormData>(
    solicitarCita,
    {},
  )
  const [elegido, setElegido] = useState<string | null>(null)

  if (estado.confirmada) {
    return (
      <div className="tarjeta p-6 text-center sm:p-8">
        <p className="text-2xl">🎉</p>
        <h2 className="mt-3 text-xl font-bold text-ink">Solicitud enviada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Pediste cita con {estado.confirmada.medico} para el{' '}
          <strong className="font-semibold text-foreground">{estado.confirmada.cuando}</strong>
          {' '}— todavía no está confirmada: el consultorio la revisa y te avisa.
        </p>
      </div>
    )
  }

  if (dias.length === 0) {
    return (
      <div className="tarjeta p-6 text-center sm:p-8">
        <h2 className="font-bold text-ink">No hay horarios disponibles</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Este consultorio no tiene huecos abiertos en las próximas semanas.
          Intenta más adelante o contáctalo directamente.
        </p>
      </div>
    )
  }

  const cuandoElegido = elegido
    ? `${etiquetaDia(
        dias.find((d) => d.huecos.some((h) => h.inicio === elegido))!.fecha,
        zona,
      )} a las ${etiquetaHora(elegido, zona)}`
    : ''

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="medico" value={medico} />
      <input type="hidden" name="inicio" value={elegido ?? ''} />
      <input type="hidden" name="cuando" value={cuandoElegido} />

      <section>
        <h2 className="font-bold text-ink">Elige un horario</h2>
        <p className="mt-1 text-sm text-muted">
          Horas de {zona.split('/').pop()!.replace('_', ' ')}.
        </p>

        <div className="mt-4 space-y-5">
          {dias.map((dia) => (
            <div key={dia.fecha}>
              <p className="text-sm font-semibold text-muted first-letter:uppercase">
                {etiquetaDia(dia.fecha, zona)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dia.huecos.map((hueco) => {
                  const activo = elegido === hueco.inicio
                  return (
                    <button
                      key={hueco.inicio}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setElegido(hueco.inicio)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition ${
                        activo
                          ? 'border-brand bg-brand-vivo text-white'
                          : 'border-border bg-surface hover:border-brand'
                      }`}
                    >
                      {etiquetaHora(hueco.inicio, zona)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tarjeta p-4 sm:p-6">
        <h2 className="font-bold text-ink">Tus datos</h2>
        {elegido ? (
          <p className="mt-1 text-sm text-brand">Horario elegido: {cuandoElegido}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">Primero elige un horario de arriba.</p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className="block text-sm font-medium text-ink">
              Nombre del paciente
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              defaultValue={estado.valores?.nombre}
              placeholder="Nombre del niño o niña"
              className="campo mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-ink">
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              defaultValue={estado.valores?.telefono}
              className="campo mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={estado.valores?.email}
              className="campo mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notas" className="block text-sm font-medium text-ink">
              Motivo de la consulta{' '}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={3}
              defaultValue={estado.valores?.notas}
              placeholder="Cuéntale al doctor qué pasa."
              className="campo mt-1.5 resize-y"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          Con un teléfono o un correo basta; lo necesitamos para confirmarte.
        </p>

        {estado.error && (
          <p role="alert" className="mt-4 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro">
            {estado.error}
          </p>
        )}

        <button
          disabled={pendiente || !elegido}
          className="boton boton-primario mt-5 w-full py-3"
        >
          {pendiente ? 'Enviando…' : 'Solicitar cita'}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          El consultorio revisa cada solicitud antes de confirmarla.
        </p>
      </section>
    </form>
  )
}
