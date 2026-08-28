import Link from 'next/link'
import { fechaSuelta, relativo } from '@/lib/fechas'
import { numeroParaWhatsApp, ligaWhatsApp } from '@/lib/whatsapp'

export type Control = {
  patient_id: string
  paciente: string
  telefono: string | null
  es_menor: boolean
  tutor: string | null
  toca_el: string
  motivo: string | null
  ultima_visita: string | null
}

/**
 * A quién le toca volver y todavía no tiene cita.
 *
 * Es la única lista del sistema que existe para **llamar**, no para consultar:
 * cada renglón es una llamada que la recepcionista puede hacer hoy. Por eso
 * trae el botón de WhatsApp con el mensaje ya escrito y la liga para agendarle
 * de una vez.
 *
 * Que la base excluya a quien ya tiene cita no es un detalle: llamarle a
 * alguien que ya viene el jueves quema la confianza en la lista, y una lista en
 * la que no se confía se deja de abrir.
 */
export function ControlesPendientes({
  controles,
  doctor,
}: {
  controles: Control[]
  doctor: string
}) {
  if (controles.length === 0) return null

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <section className="tarjeta mb-6 p-4 sm:p-5">
      <h2 className="font-semibold text-ink">
        Les toca volver ({controles.length})
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted">
        Quedaron de regresar y no tienen cita agendada.
      </p>

      <ul className="space-y-2">
        {controles.map((c) => {
          const quien = c.es_menor && c.tutor ? c.tutor : c.paciente
          const numero = numeroParaWhatsApp(c.telefono)
          const atrasado = c.toca_el < hoy

          const mensaje =
            `Hola ${quien.split(' ')[0]}, te escribimos del consultorio de ${doctor}. ` +
            `${c.es_menor ? `A ${c.paciente.split(' ')[0]} le toca` : 'Te toca'} ` +
            `${c.motivo ? `${c.motivo.toLowerCase()}` : 'su siguiente control'}. ` +
            `¿Te agendamos?`

          return (
            <li
              key={c.patient_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-marca border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/pacientes/${c.patient_id}`}
                  className="font-medium text-ink hover:underline"
                >
                  {c.paciente}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  <span className={atrasado ? 'font-medium text-alerta' : ''}>
                    {atrasado ? 'Le tocaba ' : 'Le toca '}
                    {fechaSuelta(c.toca_el)}
                  </span>
                  {c.motivo && ` · ${c.motivo}`}
                  {c.ultima_visita && ` · última visita ${relativo(c.ultima_visita)}`}
                </p>
                {c.es_menor && c.tutor && (
                  <p className="text-xs text-muted">Se le avisa a {c.tutor}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                <Link
                  href={`/admin/agendar?paciente=${c.patient_id}`}
                  className="boton boton-primario px-3 py-1.5 text-xs"
                >
                  Agendar
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
