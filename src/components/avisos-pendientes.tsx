import Link from 'next/link'
import { fechaSuelta } from '@/lib/fechas'
import { ligaWhatsApp, numeroParaWhatsApp } from '@/lib/whatsapp'
import { marcarAvisoEnviado } from '@/lib/avisos/actions'

export type AvisoPendiente = {
  id: string
  patient_id: string
  paciente: string
  telefono: string | null
  es_menor: boolean
  tutor: string | null
  due_on: string
  titulo: string
  mensaje: string | null
}

/**
 * Avisos que ya vencieron y nadie ha mandado.
 *
 * Existe aunque el cron los mande solo: mientras no haya dominio verificado el
 * correo no sale, y sin esta lista el módulo entero no serviría hasta entonces.
 * También cubre a los pacientes sin correo, que siempre van a existir.
 */
export function AvisosPendientes({
  avisos,
  doctor,
}: {
  avisos: AvisoPendiente[]
  doctor: string
}) {
  if (avisos.length === 0) return null
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <section className="tarjeta mb-6 p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Avisos por mandar ({avisos.length})</h2>
      <p className="mt-0.5 mb-3 text-sm text-muted">
        Los programaste para estas fechas y todavía no salen.
      </p>

      <ul className="space-y-2">
        {avisos.map((a) => {
          const quien = a.es_menor && a.tutor ? a.tutor : a.paciente
          const numero = numeroParaWhatsApp(a.telefono)
          const mensaje =
            `Hola ${quien.split(' ')[0]}, te escribimos del consultorio de ${doctor}. ` +
            (a.mensaje ?? `${a.titulo}. ¿Te agendamos?`)

          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{a.titulo}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <Link
                    href={`/admin/pacientes/${a.patient_id}`}
                    className="text-acento hover:underline"
                  >
                    {a.paciente}
                  </Link>
                  {' · '}
                  <span className={a.due_on <= hoy ? 'font-medium text-alerta' : ''}>
                    {a.due_on <= hoy ? 'tocaba ' : 'toca '}
                    {fechaSuelta(a.due_on)}
                  </span>
                  {a.es_menor && a.tutor && ` · se le avisa a ${a.tutor}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {numero && (
                  <a
                    href={ligaWhatsApp(numero, mensaje)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="boton boton-suave px-3 py-1.5 text-xs"
                  >
                    Escribirle
                  </a>
                )}
                <form action={marcarAvisoEnviado}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-xs font-medium text-acento hover:underline">
                    Ya le avisé
                  </button>
                </form>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
