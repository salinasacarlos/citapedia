'use client'

import Link from 'next/link'
import { CopiarLiga } from '@/components/copiar-liga'
import { ligaWhatsApp, numeroParaWhatsApp } from '@/lib/whatsapp'

/**
 * Lo que aparece justo después de aceptar. La solicitud desaparece de la lista
 * en ese momento, así que si la liga no se ofrece aquí, hay que ir a buscarla
 * a la agenda — y es justo cuando la recepcionista todavía tiene al paciente
 * en el teléfono.
 */
export function CitaAceptada({
  paciente,
  liga,
  telefono,
  correo,
  mensaje,
  rechazada = false,
}: {
  paciente: string
  liga: string
  telefono: string | null
  correo: 'enviado' | 'sin-correo' | 'falla'
  mensaje: string
  /** El mismo aviso sirve para el no: lo que cambia es qué se le manda. */
  rechazada?: boolean
}) {
  const numero = numeroParaWhatsApp(telefono)

  const aviso =
    correo === 'enviado'
      ? rechazada
        ? 'Le avisamos por correo.'
        : 'Le mandamos un correo para que confirme.'
      : correo === 'sin-correo'
        ? 'No tiene correo capturado, así que no salió ningún aviso.'
        : 'No se pudo mandar el correo. Avísale tú.'

  if (rechazada) {
    return (
      <div className="mb-6 rounded-marca border border-border bg-surface-2 px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold text-ink">Solicitud rechazada · {paciente}</p>
        <p className="mt-1 text-sm text-muted">
          {aviso} Quedó esperando una respuesta desde que pidió la cita, así que
          conviene que se entere.
        </p>

        {numero && (
          <div className="mt-3">
            <a
              href={ligaWhatsApp(numero, mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              className="boton boton-suave px-3 py-1.5 text-xs"
            >
              Avisarle por WhatsApp
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-marca border border-exito/30 bg-exito-suave px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-exito">
        Cita aceptada · {paciente}
      </p>
      <p className="mt-1 text-sm text-muted">
        {aviso} Con esta liga confirma, la mueve o avisa si no puede venir.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {numero && (
          <a
            href={ligaWhatsApp(numero, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            className="boton boton-primario px-3 py-1.5 text-xs"
          >
            Mandar por WhatsApp
          </a>
        )}
        <CopiarLiga liga={liga} />
        <Link href="/admin/agenda" className="text-xs font-medium text-acento hover:underline">
          Ver en la agenda
        </Link>
      </div>
    </div>
  )
}
