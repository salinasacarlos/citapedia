'use client'

import { useState } from 'react'
import {
  deshacerConfirmacion,
  marcarConfirmadaPorPaciente,
  marcarContactado,
} from '@/lib/admin/actions'
import { armarMensaje, ligaWhatsApp, numeroParaWhatsApp } from '@/lib/whatsapp'

export type DatosConfirmacion = {
  citaId: string
  contacto: { nombre: string; telefono: string } | null
  plantilla: string
  paciente: string
  doctor: string
  fecha: string
  hora: string
  contactadoEn: string | null
  confirmadaEn: string | null
}

export function ConfirmarAsistencia({ datos }: { datos: DatosConfirmacion }) {
  // El clic en WhatsApp abre otra ventana; marcamos aquí mismo que ya se
  // escribió para que la recepcionista no tenga que acordarse.
  const [contactado, setContactado] = useState(Boolean(datos.contactadoEn))

  if (datos.confirmadaEn) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-exito-suave px-2.5 py-1 text-xs font-medium text-exito">
          <span aria-hidden>✓</span> El paciente confirmó
        </span>
        <form action={deshacerConfirmacion}>
          <input type="hidden" name="id" value={datos.citaId} />
          <button className="text-xs text-muted hover:underline">Deshacer</button>
        </form>
      </div>
    )
  }

  const numero = numeroParaWhatsApp(datos.contacto?.telefono)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {numero ? (
        <form action={marcarContactado} className="contents">
          <input type="hidden" name="id" value={datos.citaId} />
          <a
            href={ligaWhatsApp(
              numero,
              armarMensaje(datos.plantilla, {
                paciente: datos.contacto!.nombre,
                doctor: datos.doctor,
                fecha: datos.fecha,
                hora: datos.hora,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              setContactado(true)
              // El envío queda registrado sin bloquear la apertura de WhatsApp.
              ;(e.currentTarget.closest('form') as HTMLFormElement)?.requestSubmit()
            }}
            className="boton boton-suave px-3 py-1.5 text-xs"
          >
            {contactado ? 'Volver a escribir' : 'Confirmar por WhatsApp'}
          </a>
        </form>
      ) : (
        <span className="text-xs text-muted">
          Sin teléfono para escribir
        </span>
      )}

      {contactado && (
        <>
          <span className="text-xs text-alerta">Escrito, falta que conteste</span>
          <form action={marcarConfirmadaPorPaciente}>
            <input type="hidden" name="id" value={datos.citaId} />
            <button className="boton boton-primario px-3 py-1.5 text-xs">
              Confirmó que viene
            </button>
          </form>
        </>
      )}
    </div>
  )
}
