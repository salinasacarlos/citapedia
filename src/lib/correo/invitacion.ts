import type { Correo } from './enviar'

function escapar(t: string) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * La invitación al asistente. La liga ES la credencial, así que el correo no
 * lleva nada más: ni contraseña temporal, ni datos del consultorio más allá
 * del nombre. Quien la recibe todavía no es miembro de nada.
 */
export function armarInvitacion(d: {
  para: string
  consultorio: string
  liga: string
  dias: number
}): Correo {
  const texto = [
    `${d.consultorio} te invitó a ayudarle con su agenda en CitaPedia.`,
    '',
    'Con esta liga creas tu cuenta y eliges tu propia contraseña:',
    d.liga,
    '',
    `La liga vence en ${d.dias} días y solo funciona con este correo.`,
    'Si no esperabas esto, ignóralo: sin abrirla no pasa nada.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5">
        <strong>${escapar(d.consultorio)}</strong> te invitó a ayudarle con su agenda en CitaPedia.
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7c">
        Vas a poder ver la agenda, aceptar y mover citas. El expediente clínico
        se queda con el médico.
      </p>
      <p style="margin:0;text-align:center">
        <a href="${escapar(d.liga)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Crear mi cuenta</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8b98a5;text-align:center">
        La liga vence en ${d.dias} días y solo funciona con este correo.<br>
        Si no esperabas esto, ignóralo: sin abrirla no pasa nada.
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return {
    para: d.para,
    asunto: `${d.consultorio} te invitó a su agenda en CitaPedia`,
    html,
    texto,
  }
}
