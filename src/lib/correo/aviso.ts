import type { Correo } from './enviar'

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Un aviso programado.
 *
 * No inventa contexto clínico: dice lo que el médico escribió y ofrece
 * agendar. Poner de nuestra cosecha "es momento de tu vacuna" sería que
 * CitaPedia afirme algo médico que nadie revisó.
 */
export type EtapaAviso = 'semana' | 'hoy' | 'seguimiento'

export function armarAviso(d: {
  destinatario: { nombre: string; correo: string }
  paciente: string
  esMenor: boolean
  doctor: string
  titulo: string
  mensaje: string | null
  pagina: string
  /**
   * Cuál de los toques es. El texto del médico es el mismo —es lo que él
   * quiso decir—; lo que cambia es cuándo cae y qué se le pide.
   */
  etapa?: EtapaAviso
}): Correo {
  const nombre = d.destinatario.nombre.split(' ')[0]
  const cuerpo =
    d.mensaje ??
    (d.esMenor
      ? `A ${d.paciente} le toca: ${d.titulo}.`
      : `Te toca: ${d.titulo}.`)

  const etapa = d.etapa ?? 'hoy'

  // El segundo toque solo sale si el paciente no agendó, así que puede decirlo
  // sin mentir. Y el de la semana previa avisa que todavía hay tiempo, que es
  // justo lo que lo hace útil: agendar con calma en vez de a las carreras.
  const remate =
    etapa === 'semana'
      ? 'Faltan unos días. Si quieres, aparta tu lugar desde ahora.'
      : etapa === 'seguimiento'
        ? 'Te lo recordamos por si se te pasó. Si ya no lo necesitas, ignora este mensaje.'
        : 'Puedes apartar tu lugar aquí.'

  const texto = [
    `Hola ${nombre},`,
    '',
    `Te escribimos del consultorio de ${d.doctor}.`,
    cuerpo,
    remate,
    '',
    `Puedes agendar aquí: ${d.pagina}`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Hola ${escapar(nombre)}, te escribimos del consultorio de
        <strong>${escapar(d.doctor)}</strong>.
      </p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapar(cuerpo)}</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7c">${escapar(remate)}</p>
      <p style="margin:0;text-align:center">
        <a href="${escapar(d.pagina)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Agendar mi cita</a>
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.destinatario.correo,
    asunto:
      etapa === 'seguimiento'
        ? `¿Te ayudamos a agendar? ${d.titulo}`
        : d.esMenor
          ? `Sobre ${d.paciente}: ${d.titulo}`
          : d.titulo,
    html,
    texto,
  }
}
