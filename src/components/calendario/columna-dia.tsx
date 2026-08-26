import Link from 'next/link'
import {
  etiquetaHora,
  type Banda,
  type EventoPuesto,
} from '@/lib/calendario'

/** Alto de un minuto, en píxeles. Una jornada de 10 h ocupa 720 px. */
export const PX_POR_MINUTO = 1.2

const ESTILO_EVENTO: Record<string, string> = {
  confirmed: 'bg-brand-vivo text-white border-transparent',
  requested: 'border-dashed border-brand bg-brand-suave text-brand',
  // Trama diagonal: un bloqueo no es "cerrado", es tapado a propósito, y con
  // el mismo gris del fondo se confundía con las horas fuera de horario.
  bloqueo: 'border-border text-muted',
}

const TRAMA_BLOQUEO =
  'repeating-linear-gradient(45deg, var(--surface-2) 0 6px, var(--border) 6px 7px)'

function Evento({
  evento,
  ventana,
}: {
  evento: EventoPuesto
  ventana: { desdeMin: number; hastaMin: number }
}) {
  const top = (evento.desdeMin - ventana.desdeMin) * PX_POR_MINUTO
  const alto = Math.max(18, (evento.hastaMin - evento.desdeMin) * PX_POR_MINUTO)
  const ancho = 100 / evento.carriles
  const clase =
    evento.tipo === 'bloqueo'
      ? ESTILO_EVENTO.bloqueo
      : (ESTILO_EVENTO[evento.estado ?? ''] ?? ESTILO_EVENTO.confirmed)

  const contenido = (
    <>
      <span className="block truncate font-semibold">{evento.titulo}</span>
      {alto > 34 && evento.detalle && (
        <span className="block truncate opacity-80">{evento.detalle}</span>
      )}
    </>
  )

  const estilo: React.CSSProperties = {
    top: `${top}px`,
    height: `${alto}px`,
    left: `calc(${evento.carril * ancho}% + 2px)`,
    width: `calc(${ancho}% - 4px)`,
    ...(evento.tipo === 'bloqueo' ? { backgroundImage: TRAMA_BLOQUEO } : {}),
  }

  const clases = `absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${clase}`

  // Las solicitudes se resuelven en su bandeja: desde ahí llevan a la acción.
  return evento.estado === 'requested' ? (
    <Link
      href="/admin/solicitudes"
      style={estilo}
      className={`${clases} transition hover:brightness-95`}
      title={`${evento.titulo} — solicitud pendiente`}
    >
      {contenido}
    </Link>
  ) : (
    <div style={estilo} className={clases} title={evento.titulo}>
      {contenido}
    </div>
  )
}

export function ColumnaDia({
  bandas,
  eventos,
  ventana,
  ahoraMin,
}: {
  bandas: Banda[]
  eventos: EventoPuesto[]
  ventana: { desdeMin: number; hastaMin: number }
  /** Minutos locales de "ahora", solo si esta columna es hoy. */
  ahoraMin?: number
}) {
  const alto = (ventana.hastaMin - ventana.desdeMin) * PX_POR_MINUTO

  return (
    <div
      className="relative border-l border-border bg-surface-2"
      style={{
        height: `${alto}px`,
        backgroundImage:
          'repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px var(--alto-hora))',
      }}
    >
      {/* Las horas en que sí atiende, para que el resto se lea como cerrado. */}
      {bandas.map((banda) => (
        <div
          key={`${banda.desdeMin}-${banda.hastaMin}`}
          aria-hidden
          className="absolute inset-x-0 bg-surface"
          style={{
            top: `${(banda.desdeMin - ventana.desdeMin) * PX_POR_MINUTO}px`,
            height: `${(banda.hastaMin - banda.desdeMin) * PX_POR_MINUTO}px`,
          }}
        />
      ))}

      {ahoraMin !== undefined &&
        ahoraMin >= ventana.desdeMin &&
        ahoraMin <= ventana.hastaMin && (
          <div
            aria-hidden
            className="absolute inset-x-0 z-10 border-t-2 border-peligro"
            style={{ top: `${(ahoraMin - ventana.desdeMin) * PX_POR_MINUTO}px` }}
          />
        )}

      {eventos.map((evento) => (
        <Evento key={evento.id} evento={evento} ventana={ventana} />
      ))}
    </div>
  )
}

export function ReglaHoras({
  ventana,
}: {
  ventana: { desdeMin: number; hastaMin: number }
}) {
  const horas: number[] = []
  // Se empieza una hora adentro: la etiqueta va centrada en su línea y la
  // primera se cortaría contra el borde superior.
  for (let m = Math.ceil(ventana.desdeMin / 60) * 60 + 60; m < ventana.hastaMin; m += 60) {
    horas.push(m)
  }

  return (
    <div
      className="relative w-12 shrink-0 sm:w-14"
      style={{ height: `${(ventana.hastaMin - ventana.desdeMin) * PX_POR_MINUTO}px` }}
    >
      {horas.map((m) => (
        <span
          key={m}
          className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted"
          style={{ top: `${(m - ventana.desdeMin) * PX_POR_MINUTO}px` }}
        >
          {etiquetaHora(m)}
        </span>
      ))}
    </div>
  )
}
