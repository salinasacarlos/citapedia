'use client'

import { useState } from 'react'
import {
  deshacerConfirmacion,
  marcarConfirmadaPorPaciente,
  marcarContactado,
} from '@/lib/admin/actions'
import { armarMensaje, ligaWhatsApp, numeroParaWhatsApp } from '@/lib/whatsapp'
import { CopiarLiga } from '@/components/copiar-liga'

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
  /** La liga donde el paciente confirma y sube sus datos. */
  liga: string
}

export function ConfirmarAsistencia({ datos }: { datos: DatosConfirmacion }) {
  // El clic en WhatsApp abre otra ventana; marcamos aquí mismo que ya se
  // escribió para que la recepcionista no tenga que acordarse.
  const [contactado, setContactado] = useState(Boolean(datos.contactadoEn))

  // La insignia de "confirmó" vive junto al nombre, arriba: repetirla aquí
  // llenaba la fila de lo mismo dicho dos veces.
  if (datos.confirmadaEn) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <form action={deshacerConfirmacion}>
          <input type="hidden" name="id" value={datos.citaId} />
          <button className="text-xs text-muted hover:underline">
            Deshacer confirmación
          </button>
        </form>
        {/* Sigue sirviendo después de confirmar: por ahí adelanta sus datos y mueve la cita. */}
        <CopiarLiga liga={datos.liga} />
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
                liga: datos.liga,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // El ancla vive dentro de un form, y `requestSubmit` se come la
              // apertura nativa de la pestaña: WhatsApp terminaba abriéndose
              // encima de la agenda. Se abre a mano, todavía dentro del gesto
              // del clic para que no lo bloquee el navegador, y luego se marca.
              e.preventDefault()
              const destino = e.currentTarget.href
              const form = e.currentTarget.closest('form') as HTMLFormElement | null
              window.open(destino, '_blank', 'noopener,noreferrer')
              setContactado(true)
              form?.requestSubmit()
            }}
            className="boton boton-suave px-3 py-1.5 text-xs"
          >
            {contactado ? 'Volver a escribir' : 'Confirmar por WhatsApp'}
          </a>
        </form>
      ) : (
        <span className="text-xs text-muted">
          Sin teléfono para escribir — copia la liga y mándasela por donde puedas
        </span>
      )}

      <CopiarLiga liga={datos.liga} />

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
