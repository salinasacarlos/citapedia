import { fechaLarga, hora, nombreDePila } from '@/lib/fechas'
import type { Correo } from './enviar'

function escapar(t: string) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * "Recibimos tu solicitud".
 *
 * Quien agenda a las once de la noche cierra la pestaña y no le queda nada:
 * ni constancia de lo que pidió, ni la liga de su cita, ni idea de que todavía
 * falta que el consultorio la apruebe. Al día siguiente no sabe si mandó algo.
 *
 * El asunto y el cuerpo evitan con cuidado la palabra "confirmada": la cita
 * nace `requested` y el médico decide. Prometer aquí lo que no está prometido
 * es cómo se llega a que alguien se presente un martes a una cita que nadie
 * aceptó.
 */
export function armarSolicitudRecibida(d: {
  destinatario: { nombre: string; correo: string }
  paciente: string
  esMenor: boolean
  doctor: string
  inicio: string
  zona: string
  liga: string
}): Correo {
  const fecha = fechaLarga(d.inicio, d.zona)
  const horaTexto = hora(d.inicio, d.zona)
  const deQuien = d.esMenor ? `la cita de ${d.paciente}` : 'tu cita'

  const texto = [
    `Hola ${nombreDePila(d.destinatario.nombre)},`,
    '',
    `Recibimos tu solicitud para ${deQuien} con ${d.doctor}:`,
    `${fecha} a las ${horaTexto}.`,
    '',
    'Todavía falta que el consultorio la apruebe. Te avisamos en cuanto respondan.',
    '',
    `Aquí puedes verla, avisar si ya no puedes, o adelantar tus datos: ${d.liga}`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Hola ${escapar(nombreDePila(d.destinatario.nombre))}, recibimos tu solicitud
        para ${escapar(deQuien)} con <strong>${escapar(d.doctor)}</strong>.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f6f7f9;border-radius:12px;padding:16px">
        <tr><td>
          <p style="margin:0;font-size:16px;font-weight:600">${escapar(fecha)}</p>
          <p style="margin:4px 0 0;font-size:15px;color:#5b6b7c">${escapar(horaTexto)}</p>
        </td></tr>
      </table>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7c">
        Todavía falta que el consultorio la apruebe. Te avisamos en cuanto respondan.
      </p>

      <p style="margin:0;text-align:center">
        <a href="${escapar(d.liga)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Ver mi cita</a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#5b6b7c;text-align:center">
        Desde ahí puedes avisar si ya no puedes ir, o adelantar tus datos para la consulta.
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.destinatario.correo,
    asunto: `Recibimos tu solicitud con ${d.doctor}`,
    html,
    texto,
  }
}
