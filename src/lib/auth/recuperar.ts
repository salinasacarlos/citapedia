'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCorreo } from '@/lib/correo/enviar'
import { armarRecuperacion } from '@/lib/correo/recuperar'
import { anotarFalloDeCorreo } from '@/lib/correo/anotar-fallo'
import { problemaDelSitio } from '@/lib/sitio'

export type ResultadoRecuperar = { error?: string; listo?: boolean }

// Cuánto hay que esperar entre una liga y la siguiente vive en la base, en
// `puede_recuperar`: es donde está el dato que hay que mirar.

/** Lo que dura la liga del lado de Supabase. */
const VIGENCIA_MINUTOS = 60

/**
 * Manda la liga para volver a entrar.
 *
 * La respuesta es **siempre la misma**, exista o no la cuenta. Si dijera "no
 * hay nadie con ese correo", cualquiera podría averiguar qué médicos usan
 * CitaPedia probando direcciones — y con eso ya sabría a quién atacar.
 *
 * El correo sale por Resend y no por el SMTP de Supabase: así usa la misma
 * plantilla y el mismo remitente que todo lo demás, y no depende de un canal
 * que no tenemos configurado.
 */
export async function pedirRecuperacion(
  _estado: ResultadoRecuperar,
  datos: FormData,
): Promise<ResultadoRecuperar> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return { error: 'Escribe un correo válido.' }

  if (!process.env.SUPABASE_SECRET_KEY) {
    return { error: 'Falta configurar el envío en este entorno.' }
  }

  // Aquí nadie va a leer un error: la respuesta es siempre la misma para no
  // delatar qué cuentas existen. Con el sitio mal puesto la liga no serviría,
  // así que se anota como falla de correo y no se quema el token del usuario.
  const problema = problemaDelSitio()
  if (problema) {
    await anotarFalloDeCorreo('recuperacion', problema)
    return { listo: true }
  }

  const admin = createAdminClient()
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  try {
    // El freno va ANTES de generar: `generateLink` invalida el token anterior
    // en cuanto se llama, así que frenar después dejaría muerta la liga que ya
    // se mandó sin poner otra en su lugar. La función de la base contesta lo
    // mismo para un correo inexistente, así que preguntarle no revela nada.
    const { data: puede } = await admin.rpc('puede_recuperar', { p_email: email })
    if (puede === false) return { listo: true }

    const { data: enlace, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    // Cuenta inexistente: se calla y responde igual que en el caso bueno.
    if (error || !enlace?.properties?.hashed_token) return { listo: true }

    const envio = await enviarCorreo(
      armarRecuperacion({
        para: email,
        liga: `${sitio}/auth/confirm?token_hash=${enlace.properties.hashed_token}&type=recovery&next=%2Fdefinir-contrasena`,
        minutos: VIGENCIA_MINUTOS,
      }),
    )

    // Al usuario se le sigue diciendo lo mismo pase lo que pase, pero el
    // fallo deja de ser invisible: sin esto, que Resend rechace es algo que
    // nadie descubre hasta que alguien se queda sin poder entrar.
    if (!envio.ok) await anotarFalloDeCorreo('recuperacion', envio.error)
  } catch (err) {
    await anotarFalloDeCorreo('recuperacion', String(err).slice(0, 200))
  }

  return { listo: true }
}
