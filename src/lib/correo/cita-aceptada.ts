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
 * "El consultorio te aceptó la cita". Es distinto del recordatorio: llega al
 * momento de la decisión, y lo que pide es que el paciente confirme que va a
 * ir. El recordatorio llega el día antes y solo refresca la memoria.
 */
export function armarCitaAceptada(d: {
  destinatario: { nombre: string; correo: string }
  paciente: string
  esMenor: boolean
  doctor: string
  direccion: string | null
  telefono: string | null
  inicio: string
  zona: string
  liga: string
}): Correo {
  const fecha = fechaLarga(d.inicio, d.zona)
  const horaTexto = hora(d.inicio, d.zona)
  const deQuien = d.esMenor ? `La cita de ${d.paciente}` : 'Tu cita'

  const texto = [
    `Hola ${nombreDePila(d.destinatario.nombre)},`,
    '',
    `${d.doctor} aceptó la solicitud. ${deQuien} quedó apartada:`,
    `${fecha} a las ${horaTexto}.`,
    d.direccion ? `Dirección: ${d.direccion}` : null,
    d.telefono ? `Teléfono del consultorio: ${d.telefono}` : null,
    '',
    `Confírmanos que vas a venir, muévela o avísanos si no puedes: ${d.liga}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 4px;font-size:13px;color:#12a594;font-weight:600">Cita confirmada</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">
        Hola ${escapar(nombreDePila(d.destinatario.nombre))}, <strong>${escapar(d.doctor)}</strong> aceptó la solicitud.
      </p>

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
        <a href="${escapar(d.liga)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Confirmar que voy a ir</a>
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#5b6b7c;text-align:center">
        Desde ahí también puedes moverla o avisarnos si no vas a poder venir.
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.destinatario.correo,
    asunto: `${deQuien} con ${d.doctor}: ${fecha}`,
    html,
    texto,
  }
}
