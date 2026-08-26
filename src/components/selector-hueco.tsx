'use client'

import { useMemo, useRef, useState } from 'react'
import { diaDeLaSemana, sumarDias } from '@/lib/calendario'
import type { DiaConHuecos } from '@/lib/slots'

const INICIALES_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function etiquetaDia(fecha: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00Z`))
}

export function etiquetaHora(iso: string, zona: string) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: zona,
  }).format(new Date(iso))
}

function etiquetaMes(mes: string) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${mes}-01T12:00:00Z`))
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

/**
 * Elegir día y luego hora, como en Calendly. Mostrar todos los horarios de
 * todos los días a la vez produce una pared de botones idénticos donde nadie
 * encuentra nada, y en un teléfono es peor.
 */
/**
 * Consulta de contenedor, no de viewport: este selector vive tanto en una
 * página ancha como dentro de una tarjeta angosta, y `md:` solo sabe del
 * tamaño de la ventana — dentro de la tarjeta las horas quedaban ilegibles.
 */
export function SelectorHueco({
  dias,
  zona,
  onElegir,
}: {
  dias: DiaConHuecos[]
  zona: string
  onElegir: (inicio: string, fecha: string) => void
}) {
  const porFecha = useMemo(() => new Map(dias.map((d) => [d.fecha, d.huecos])), [dias])
  const meses = useMemo(
    () => [...new Set(dias.map((d) => d.fecha.slice(0, 7)))].sort(),
    [dias],
  )

  const [mes, setMes] = useState(() => dias[0]?.fecha.slice(0, 7) ?? '')
  const [dia, setDia] = useState<string | null>(() => dias[0]?.fecha ?? null)
  const listaHoras = useRef<HTMLDivElement>(null)

  /**
   * En móvil el calendario ocupa casi toda la pantalla, así que al elegir día
   * las horas quedan abajo, invisibles. Se acerca solo si hace falta: en
   * escritorio ya están al lado y mover la página sería molesto.
   */
  function elegirDia(fecha: string) {
    setDia(fecha)
    requestAnimationFrame(() => {
      const caja = listaHoras.current?.getBoundingClientRect()
      if (caja && caja.top > window.innerHeight - 120) {
        listaHoras.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  const huecosDelDia = dia ? (porFecha.get(dia) ?? []) : []
  const iMes = meses.indexOf(mes)

  return (
    <div className="@container">
      <div className="gap-6 @2xl:grid @2xl:grid-cols-[auto_1fr]">
      <div className="tarjeta p-4 @2xl:w-80">
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
            <span key={i} aria-hidden className="pb-1 text-center text-xs font-medium text-muted">
              {inicial}
            </span>
          ))}

          {casillasDelMes(mes).map((fecha, i) => {
            if (!fecha) return <span key={`v${i}`} />

            const libre = porFecha.has(fecha)
            const activo = fecha === dia

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
                {Number(fecha.slice(8))}
              </button>
            )
          })}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 rounded-full bg-brand" /> Días con horarios libres
        </p>
      </div>

      <div ref={listaHoras} className="mt-5 scroll-mt-4 @2xl:mt-0">
        {dia ? (
          <>
            <p className="text-sm font-semibold text-ink first-letter:uppercase">
              {etiquetaDia(dia)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {huecosDelDia.length}{' '}
              {huecosDelDia.length === 1 ? 'horario libre' : 'horarios libres'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-3 @2xl:max-h-96 @2xl:overflow-y-auto @2xl:pr-1">
              {huecosDelDia.map((hueco) => (
                <button
                  key={hueco.inicio}
                  type="button"
                  onClick={() => onElegir(hueco.inicio, dia)}
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
    </div>
  )
}
