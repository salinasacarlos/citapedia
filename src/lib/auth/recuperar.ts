'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCorreo } from '@/lib/correo/enviar'
import { armarRecuperacion } from '@/lib/correo/recuperar'

export type ResultadoRecuperar = { error?: string; listo?: boolean }

/** Cuánto hay que esperar entre una liga y la siguiente, para el mismo correo. */
const ESPERA_SEGUNDOS = 60

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

  const admin = createAdminClient()
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  try {
    const { data: enlace, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    // Cuenta inexistente: se calla y responde igual que en el caso bueno.
    if (error || !enlace?.properties?.hashed_token) return { listo: true }

    // Freno simple contra el bombardeo: `generateLink` no pasa por los límites
    // de Supabase, así que sin esto alguien podría llenarle el buzón a un
    // médico con solo saber su correo. La marca la escribe el propio Supabase.
    const anterior = enlace.user?.recovery_sent_at
    if (anterior) {
      const desde = (Date.now() - new Date(anterior).getTime()) / 1000
      // La liga que acabamos de generar ya movió la marca, así que un valor
      // muy fresco solo puede venir de una petición anterior a esta.
      if (desde > 1 && desde < ESPERA_SEGUNDOS) return { listo: true }
    }

    await enviarCorreo(
      armarRecuperacion({
        para: email,
        liga: `${sitio}/auth/confirm?token_hash=${enlace.properties.hashed_token}&type=recovery&next=%2Fdefinir-contrasena`,
        minutos: VIGENCIA_MINUTOS,
      }),
    )
  } catch {
    // Tampoco aquí se distingue: un fallo de envío no debe revelar nada.
  }

  return { listo: true }
}
