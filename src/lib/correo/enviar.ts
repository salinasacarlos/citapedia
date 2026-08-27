/**
 * Envío de correo con Resend.
 *
 * Se habla con la API por HTTP en vez de meter el SDK: es un POST con tres
 * campos, y una dependencia menos en un servidor que ya manda datos de salud.
 */

const API = 'https://api.resend.com/emails'

export type Correo = {
  para: string
  asunto: string
  html: string
  texto: string
}

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; error: string }

/**
 * El remitente sale de la variable de entorno porque depende del dominio que
 * esté verificado en Resend. Sin dominio propio, `onboarding@resend.dev` solo
 * puede escribirle al dueño de la cuenta: sirve para probar, no para producción.
 */
function remitente() {
  return process.env.RESEND_FROM ?? 'CitaPedia <onboarding@resend.dev>'
}

/**
 * Los errores de Resend llegan en inglés y hablan de su producto, no del
 * nuestro. El más frecuente por mucho es el del dominio sin verificar, y
 * dicho tal cual no le explica nada a quien está frente a la pantalla.
 */
export function traducirResend(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('own email address') || m.includes('verify a domain')) {
    return 'Todavía no hay dominio verificado en Resend, así que solo se puede escribir a la cuenta del dueño.'
  }
  if (m.includes('api key is invalid') || m.includes('unauthorized')) {
    return 'La llave de Resend no es válida.'
  }
  if (m.includes('rate') && m.includes('limit')) {
    return 'Resend está limitando los envíos; inténtalo en un momento.'
  }
  return mensaje
}

export async function enviarCorreo(correo: Correo): Promise<ResultadoEnvio> {
  const llave = process.env.RESEND_API_KEY
  if (!llave) return { ok: false, error: 'Falta RESEND_API_KEY.' }

  const respuesta = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remitente(),
      to: [correo.para],
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }),
  })

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null

  if (!respuesta.ok) {
    return {
      ok: false,
      error: cuerpo?.message
        ? traducirResend(cuerpo.message)
        : `Resend respondió ${respuesta.status}.`,
    }
  }
  return { ok: true, id: cuerpo?.id ?? '' }
}
