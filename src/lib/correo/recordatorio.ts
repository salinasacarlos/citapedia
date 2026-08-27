import { armarMensaje } from '@/lib/whatsapp'
import { fechaLarga, hora, nombreDePila } from '@/lib/fechas'
import type { Correo } from './enviar'

export type DatosRecordatorio = {
  /** A quién se le escribe: el paciente, o quien responde por él. */
  destinatario: { nombre: string; correo: string }
  paciente: string
  esMenor: boolean
  doctor: string
  direccion: string | null
  telefono: string | null
  inicio: string
  zona: string
  plantilla: string
  liga: string
}

function escapar(t: string) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * El correo se arma con la misma plantilla que el WhatsApp manual. Que los dos
 * canales digan lo mismo no es una economía: es que el paciente reciba el mismo
 * mensaje sin importar por dónde le llegue.
 */
export function armarRecordatorio(d: DatosRecordatorio): Correo {
  const fecha = fechaLarga(d.inicio, d.zona)
  const horaTexto = hora(d.inicio, d.zona)

  // `{paciente}` es el nombre de QUIEN RECIBE, igual que en el WhatsApp
  // manual: la plantilla empieza con "Hola {paciente}", y a la cita de un menor
  // se le escribe a su tutor. Poner ahí al paciente saludaba al equivocado.
  const cuerpo = armarMensaje(d.plantilla, {
    paciente: nombreDePila(d.destinatario.nombre),
    doctor: d.doctor,
    fecha,
    hora: horaTexto,
    // La liga va en su propio botón, no incrustada en la frase.
    liga: '',
  })

  // De quién es la cita es otro dato, y va en el recuadro: quien la abre no
  // siempre es el paciente.
  const deQuien = d.esMenor ? `La cita de ${d.paciente}` : 'Tu cita'

  const texto = [
    cuerpo,
    '',
    `${deQuien}: ${fecha} a las ${horaTexto}.`,
    d.direccion ? `Dirección: ${d.direccion}` : null,
    d.telefono ? `Teléfono del consultorio: ${d.telefono}` : null,
    '',
    `Confirma, muévela o avisa si no puedes venir: ${d.liga}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapar(cuerpo)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f7f5;border-radius:12px;padding:16px;text-align:center">
        <tr><td>
          <p style="margin:0;font-size:12px;color:#5b6b7c">${escapar(deQuien)}</p>
          <p style="margin:6px 0 0;font-size:16px;font-weight:700">${escapar(fecha)}</p>
          <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#12a594">${escapar(horaTexto)}</p>
        </td></tr>
      </table>

      ${
        d.direccion || d.telefono
          ? `<p style="margin:16px 0 0;font-size:13px;color:#5b6b7c;text-align:center">
              ${d.direccion ? escapar(d.direccion) : ''}${d.direccion && d.telefono ? '<br>' : ''}${d.telefono ? escapar(d.telefono) : ''}
            </p>`
          : ''
      }

      <p style="margin:24px 0 0;text-align:center">
        <a href="${escapar(d.liga)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Confirmar o mover mi cita</a>
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#5b6b7c;text-align:center">
        Si no puedes venir, avísanos desde ahí. Nos ayuda a darle el lugar a alguien más.
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.destinatario.correo,
    asunto: `Recordatorio: ${d.esMenor ? `cita de ${d.paciente}` : 'tu cita'} el ${fecha}`,
    html,
    texto,
  }
}

/** A quién se le escribe. Misma regla que WhatsApp: al menor, por su tutor. */
export function correoParaAvisar(paciente: {
  name: string
  email: string | null
  is_minor: boolean | null
  tutor_name: string | null
  tutor_email: string | null
}): { nombre: string; correo: string } | null {
  if (paciente.is_minor && paciente.tutor_email) {
    return { nombre: paciente.tutor_name ?? 'el responsable', correo: paciente.tutor_email }
  }
  if (paciente.email) return { nombre: paciente.name, correo: paciente.email }
  if (paciente.tutor_email) {
    return { nombre: paciente.tutor_name ?? 'el responsable', correo: paciente.tutor_email }
  }
  return null
}
