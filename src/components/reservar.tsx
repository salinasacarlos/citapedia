'use client'

import { useActionState, useMemo, useRef, useState } from 'react'
import { solicitarCita, type EstadoReserva } from '@/lib/publico/actions'
import { diaDeLaSemana, sumarDias } from '@/lib/calendario'
import type { DiaConHuecos } from '@/lib/slots'

const INICIALES_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function etiquetaDia(fecha: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00Z`))
}

function etiquetaMes(mes: string) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${mes}-01T12:00:00Z`))
}

function etiquetaHora(iso: string, zona: string) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zona,
  }).format(new Date(iso))
}

/** Las casillas del mes, con huecos al inicio para que caiga en su columna. */
function casillasDelMes(mes: string): (string | null)[] {
  const primero = `${mes}-01`
  const dow = diaDeLaSemana(primero)
  // La semana empieza en lunes, y diaDeLaSemana da 0 para domingo.
  const relleno = dow === 0 ? 6 : dow - 1

  const casillas: (string | null)[] = Array(relleno).fill(null)
  let dia = primero
  while (dia.slice(0, 7) === mes) {
    casillas.push(dia)
    dia = sumarDias(dia, 1)
  }
  return casillas
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

  const porFecha = useMemo(
    () => new Map(dias.map((d) => [d.fecha, d.huecos])),
    [dias],
  )
  const meses = useMemo(
    () => [...new Set(dias.map((d) => d.fecha.slice(0, 7)))].sort(),
    [dias],
  )

  const [mes, setMes] = useState(() => dias[0]?.fecha.slice(0, 7) ?? '')
  const [dia, setDia] = useState<string | null>(() => dias[0]?.fecha ?? null)
  const [hora, setHora] = useState<string | null>(null)
  const listaHoras = useRef<HTMLDivElement>(null)

  /**
   * En móvil el calendario ocupa casi toda la pantalla, así que al elegir día
   * las horas quedan abajo, invisibles. Se acerca solo si hace falta: en
   * escritorio ya están al lado y mover la página sería molesto.
   */
  function elegirDia(fecha: string) {
    setDia(fecha)
    setHora(null)
    requestAnimationFrame(() => {
      const caja = listaHoras.current?.getBoundingClientRect()
      if (caja && caja.top > window.innerHeight - 120) {
        listaHoras.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

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

  const huecosDelDia = dia ? (porFecha.get(dia) ?? []) : []
  const cuandoElegido =
    hora && dia ? `${etiquetaDia(dia)} a las ${etiquetaHora(hora, zona)}` : ''
  const iMes = meses.indexOf(mes)

  // ------------------------------------------------- paso 3: los datos
  if (hora && dia) {
    return (
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="medico" value={medico} />
        <input type="hidden" name="inicio" value={hora} />
        <input type="hidden" name="cuando" value={cuandoElegido} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-brand/30 bg-brand-suave px-4 py-3">
          <div>
            <p className="text-xs font-medium text-brand">Horario elegido</p>
            <p className="font-semibold text-ink first-letter:uppercase">{cuandoElegido}</p>
          </div>
          <button
            type="button"
            onClick={() => setHora(null)}
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

      <div className="mt-5 gap-6 md:grid md:grid-cols-[auto_1fr]">
        {/* ---------- El mes ---------- */}
        <div className="tarjeta p-4 md:w-80">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={iMes <= 0}
              onClick={() => setMes(meses[iMes - 1])}
              aria-label="Mes anterior"
              className="boton boton-suave px-2.5 py-1 disabled:opacity-30"
            >
              ←
            </button>
            <p className="text-sm font-semibold text-ink first-letter:uppercase">
              {etiquetaMes(mes)}
            </p>
            <button
              type="button"
              disabled={iMes >= meses.length - 1}
              onClick={() => setMes(meses[iMes + 1])}
              aria-label="Mes siguiente"
              className="boton boton-suave px-2.5 py-1 disabled:opacity-30"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {INICIALES_SEMANA.map((inicial, i) => (
              <span
                key={i}
                aria-hidden
                className="pb-1 text-center text-xs font-medium text-muted"
              >
                {inicial}
              </span>
            ))}

            {casillasDelMes(mes).map((fecha, i) => {
              if (!fecha) return <span key={`v${i}`} />

              const libre = porFecha.has(fecha)
              const activo = fecha === dia
              const numero = Number(fecha.slice(8))

              return (
                <button
                  key={fecha}
                  type="button"
                  disabled={!libre}
                  aria-pressed={activo}
                  aria-label={`${etiquetaDia(fecha)}${libre ? '' : ', sin horarios'}`}
                  onClick={() => elegirDia(fecha)}
                  className={`aspect-square rounded-full text-sm tabular-nums transition ${
                    activo
                      ? 'bg-brand-vivo font-semibold text-white'
                      : libre
                        ? 'font-semibold text-brand hover:bg-brand-suave'
                        : 'text-muted/40'
                  }`}
                >
                  {numero}
                </button>
              )
            })}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full bg-brand" /> Días con horarios libres
          </p>
        </div>

        {/* ---------- Las horas del día elegido ---------- */}
        <div ref={listaHoras} className="mt-5 scroll-mt-4 md:mt-0">
          {dia ? (
            <>
              <p className="text-sm font-semibold text-ink first-letter:uppercase">
                {etiquetaDia(dia)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {huecosDelDia.length}{' '}
                {huecosDelDia.length === 1 ? 'horario libre' : 'horarios libres'}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:max-h-96 md:overflow-y-auto md:pr-1">
                {huecosDelDia.map((hueco) => (
                  <button
                    key={hueco.inicio}
                    type="button"
                    onClick={() => setHora(hueco.inicio)}
                    className="rounded-lg border border-border bg-surface py-2.5 text-sm font-semibold tabular-nums text-brand transition hover:border-brand hover:bg-brand-suave"
                  >
                    {etiquetaHora(hueco.inicio, zona)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Elige un día en el calendario.</p>
          )}
        </div>
      </div>
    </section>
  )
}
