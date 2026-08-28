import type { Correo } from './enviar'

function escapar(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * La liga para volver a entrar.
 *
 * No saluda por su nombre a propósito: quien pide recuperar una contraseña
 * puede no ser el dueño de la cuenta, y el correo no tiene por qué confirmarle
 * a un extraño de quién es la dirección que acaba de teclear.
 */
export function armarRecuperacion(d: { para: string; liga: string; minutos: number }): Correo {
  const texto = [
    'Pediste volver a entrar a CitaPedia.',
    '',
    'Con esta liga eliges una contraseña nueva:',
    d.liga,
    '',
    `Vence en ${d.minutos} minutos y sirve una sola vez.`,
    'Si no fuiste tú, ignora este correo: tu contraseña sigue como estaba.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2a41">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 8px;font-size:16px;font-weight:600">Vuelve a entrar</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5b6b7c">
        Pediste volver a entrar a CitaPedia. Con esta liga eliges una contraseña
        nueva; nadie más la ve, ni nosotros.
      </p>
      <p style="margin:0;text-align:center">
        <a href="${escapar(d.liga)}" style="display:inline-block;background:#12a594;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Elegir contraseña</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8b98a5;text-align:center">
        Vence en ${d.minutos} minutos y sirve una sola vez.<br>
        Si no fuiste tú, ignora este correo: tu contraseña sigue como estaba.
      </p>
    </td></tr>
  </table>
  <p style="margin:16px auto 0;max-width:480px;font-size:11px;color:#8b98a5;text-align:center">Agenda gestionada con CitaPedia.</p>
</body></html>`

  return { para: d.para, asunto: 'Vuelve a entrar a CitaPedia', html, texto }
}
