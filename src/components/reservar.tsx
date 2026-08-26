'use client'

import { useActionState, useState } from 'react'
import { solicitarCita, type EstadoReserva } from '@/lib/publico/actions'
import { SelectorHueco, etiquetaDia, etiquetaHora } from '@/components/selector-hueco'
import type { DiaConHuecos } from '@/lib/slots'

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

  const [elegido, setElegido] = useState<{ inicio: string; fecha: string } | null>(null)

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
    ? `${etiquetaDia(elegido.fecha)} a las ${etiquetaHora(elegido.inicio, zona)}`
    : ''

  // ------------------------------------------------- paso 3: los datos
  if (elegido) {
    return (
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="medico" value={medico} />
        <input type="hidden" name="inicio" value={elegido.inicio} />
        <input type="hidden" name="cuando" value={cuandoElegido} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-brand/30 bg-brand-suave px-4 py-3">
          <div>
            <p className="text-xs font-medium text-brand">Horario elegido</p>
            <p className="font-semibold text-ink first-letter:uppercase">{cuandoElegido}</p>
          </div>
          <button
            type="button"
            onClick={() => setElegido(null)}
            className="text-sm font-medium text-acento hover:underline"
          >
            Cambiar
          </button>
        </div>

        <section className="tarjeta p-4 sm:p-6">
          <h2 className="font-bold text-ink">Tus datos</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="nombre" className="block text-sm font-medium text-ink">
                Nombre del paciente
              </label>
              <input
                id="nombre"
                name="nombre"
                required
                autoFocus
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
                inputMode="tel"
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
                inputMode="email"
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
            <p
              role="alert"
              className="mt-4 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro"
            >
              {estado.error}
            </p>
          )}

          <button disabled={pendiente} className="boton boton-primario mt-5 w-full py-3">
            {pendiente ? 'Enviando…' : 'Solicitar cita'}
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            El consultorio revisa cada solicitud antes de confirmarla.
          </p>
        </section>
      </form>
    )
  }

  // ------------------------------- pasos 1 y 2: el día y luego la hora
  return (
    <section>
      <h2 className="font-bold text-ink">Agenda tu cita</h2>
      <p className="mt-1 text-sm text-muted">
        Elige un día y luego la hora. Horas de{' '}
        {zona.split('/').pop()!.replace('_', ' ')}.
      </p>

      <div className="mt-5">
        <SelectorHueco
          dias={dias}
          zona={zona}
          onElegir={(inicio, fecha) => setElegido({ inicio, fecha })}
        />
      </div>
    </section>
  )
}
