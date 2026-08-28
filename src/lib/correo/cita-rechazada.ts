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
 * "No pudimos tomar esa cita".
 *
 * Es el correo más delicado del sistema: del otro lado hay alguien que pidió
 * ayuda y recibe un no. Por eso no da explicaciones que no tenemos —el motivo
 * casi nunca se captura, e inventar uno sería peor— y sí ofrece la única cosa
 * útil: otros horarios, a un clic. Sin eso, el paciente se queda sin saber qué
 * hacer y el consultorio pierde una consulta que sí podía dar.
 */
export function armarCitaRechazada(d: {
  destinatario: { nombre: string; correo: string }
  paciente: string
  esMenor: boolean
  doctor: string
  telefono: string | null
  inicio: string
  zona: string
  pagina: string
}): Correo {
  const fecha = fechaLarga(d.inicio, d.zona)
  const horaTexto = hora(d.inicio, d.zona)
  const deQuien = d.esMenor ? `la cita de ${d.paciente}` : 'tu cita'

  const texto = [
    `Hola ${nombreDePila(d.destinatario.nombre)},`,
    '',
    `${d.doctor} no pudo tomar ${deQuien} del ${fecha} a las ${horaTexto}.`,
    '',
    `Puedes elegir otro horario aquí: ${d.pagina}`,
    d.telefono ? `O llamar al consultorio: ${d.telefono}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Hola ${escapar(nombreDePila(d.destinatario.nombre))}, <strong>${escapar(d.doctor)}</strong>
        no pudo tomar ${escapar(deQuien)} del ${escapar(fecha)} a las ${escapar(horaTexto)}.
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7c">
        Esa hora ya no está disponible, pero hay otras abiertas.
      </p>

      <p style="margin:0;text-align:center">
        <a href="${escapar(d.pagina)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Ver otros horarios</a>
      </p>
      ${
        d.telefono
          ? `<p style="margin:16px 0 0;font-size:13px;color:#5b6b7c;text-align:center">
              O llama al consultorio: ${escapar(d.telefono)}
            </p>`
          : ''
      }
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.destinatario.correo,
    asunto: `Sobre ${deQuien} con ${d.doctor}`,
    html,
    texto,
  }
}
