'use client'

import { useActionState, useState } from 'react'
import { solicitarCita, type EstadoReserva } from '@/lib/publico/actions'
import { SelectorHueco, etiquetaDia, etiquetaHora } from '@/components/selector-hueco'
import { DeclararDatos } from '@/components/declarar-datos'
import { CampoTelefono } from '@/components/campo-telefono'
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
  // Preguntar para quién es la cita evita el enredo de después: si no, el
  // nombre es de una persona y el teléfono de otra, sin que nada lo diga.
  const [paraOtro, setParaOtro] = useState(false)

  if (estado.confirmada) {
    return (
      <>
      <div className="tarjeta p-6 text-center sm:p-8">
        <p className="text-2xl">🎉</p>
        <h2 className="mt-3 text-xl font-bold text-ink">Solicitud enviada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Pediste cita con {estado.confirmada.medico} para el{' '}
          <strong className="font-semibold text-foreground">{estado.confirmada.cuando}</strong>
          {' '}— todavía no está confirmada: el consultorio la revisa y te avisa.
        </p>
      </div>

      <DeclararDatos citaId={estado.confirmada.token} medico={estado.confirmada.medico} />
      </>
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
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-ink">¿Para quién es la cita?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { valor: false, etiqueta: 'Para mí' },
                  { valor: true, etiqueta: 'Para alguien más' },
                ].map((opcion) => (
                  <button
                    key={String(opcion.valor)}
                    type="button"
                    aria-pressed={paraOtro === opcion.valor}
                    onClick={() => setParaOtro(opcion.valor)}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                      paraOtro === opcion.valor
                        ? 'border-brand bg-brand-suave text-brand'
                        : 'border-border bg-surface hover:border-brand'
                    }`}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
              <input type="hidden" name="para_otro" value={paraOtro ? '1' : '0'} />
            </fieldset>

            <div className="sm:col-span-2">
              <label htmlFor="nombre" className="block text-sm font-medium text-ink">
                {paraOtro ? 'Nombre de quien va a la consulta' : 'Tu nombre'}
              </label>
              <input
                id="nombre"
                name="nombre"
                required
                autoFocus
                defaultValue={estado.valores?.nombre}
                placeholder={paraOtro ? 'Nombre del paciente' : 'Nombre completo'}
                className="campo mt-1.5"
              />
            </div>

            {paraOtro && (
              <>
                <div>
                  <label htmlFor="tutor" className="block text-sm font-medium text-ink">
                    Tu nombre
                  </label>
                  <input
                    id="tutor"
                    name="tutor"
                    required
                    defaultValue={estado.valores?.tutor}
                    className="campo mt-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="parentesco" className="block text-sm font-medium text-ink">
                    Tu parentesco <span className="font-normal text-muted">(opcional)</span>
                  </label>
                  <input
                    id="parentesco"
                    name="parentesco"
                    list="parentescos"
                    placeholder="Madre, padre, hijo…"
                    defaultValue={estado.valores?.parentesco}
                    className="campo mt-1.5"
                  />
                  <datalist id="parentescos">
                    {['Madre', 'Padre', 'Tutor', 'Hijo', 'Hija', 'Cónyuge', 'Cuidador'].map(
                      (r) => (
                        <option key={r} value={r} />
                      ),
                    )}
                  </datalist>
                </div>
              </>
            )}
            <CampoTelefono
              name="telefono"
              label="Teléfono de WhatsApp"
              valorInicial={estado.valores?.telefono}
            />
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
            {paraOtro
              ? 'El teléfono y el correo son tuyos: es a ti a quien avisamos.'
              : 'Con un teléfono o un correo basta; lo necesitamos para confirmarte.'}
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
