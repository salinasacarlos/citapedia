'use server'

import { problemaDelSitio } from '@/lib/sitio'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { enviarCorreo } from '@/lib/correo/enviar'
import { armarInvitacion } from '@/lib/correo/invitacion'

export type ResultadoEquipo = {
  error?: string
  ok?: string
  token?: string
  /** Por qué no salió el correo. La liga sigue sirviendo: se pasa a mano. */
  avisoEnvio?: string
}

/** Días que una invitación sigue sirviendo. */
const VIGENCIA_DIAS = 7

/**
 * Manda la invitación por correo, y si no se puede lo dice sin estorbar.
 *
 * El correo es una comodidad, no la invitación: la invitación ya quedó grabada
 * y la liga se puede copiar. Si esto reventara la acción, un problema de
 * Resend dejaría al médico sin poder invitar a nadie.
 */
async function mandarInvitacion(
  email: string,
  consultorio: string,
  token: string,
  responder?: string | null,
): Promise<string | undefined> {
  const problema = problemaDelSitio()
  if (problema) return `${problema} Mientras tanto, comparte la liga tú.`
  const sitio = process.env.NEXT_PUBLIC_SITE_URL

  try {
    const envio = await enviarCorreo({
      responder,
      ...armarInvitacion({
        para: email,
        consultorio,
        liga: `${sitio}/invitacion/${token}`,
        dias: VIGENCIA_DIAS,
      }),
    })
    if (!envio.ok) return `No se pudo mandar el correo (${envio.error}). Pásale la liga tú.`
  } catch {
    return 'No se pudo mandar el correo. Pásale la liga tú.'
  }
  return undefined
}

function traducir(mensaje: string): string {
  if (mensaje.includes('invitations_pendiente_unica')) {
    return 'Ya hay una invitación pendiente para ese correo. Cancélala o comparte la liga que ya existe.'
  }
  if (mensaje.includes('row-level security')) {
    return 'Solo el dueño del consultorio puede invitar.'
  }
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se pudo completar la operación.'
}

export async function invitarAsistente(
  _estado: ResultadoEquipo,
  datos: FormData,
): Promise<ResultadoEquipo> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Solo el dueño del consultorio puede invitar.' }

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Escribe un correo válido.' }
  if (email === profesional.email?.toLowerCase()) {
    return { error: 'Ese es tu propio correo.' }
  }

  // 32 bytes al azar: la liga es la credencial, tiene que ser inadivinable.
  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + VIGENCIA_DIAS * 86_400_000)

  const supabase = await createClient()
  const { error } = await supabase.from('invitations').insert({
    professional_id: profesional.id,
    email,
    role: 'assistant',
    token,
    expires_at: expira.toISOString(),
  })

  if (error) return { error: traducir(error.message) }

  const avisoEnvio = await mandarInvitacion(email, profesional.name, token, profesional.email)

  revalidatePath('/admin/equipo')
  return {
    ok: avisoEnvio ? `Invitación lista para ${email}.` : `Invitación enviada a ${email}.`,
    token,
    avisoEnvio,
  }
}

/**
 * Revoca la invitación vigente y crea otra. Sirve cuando la anterior venció o
 * cuando la liga se compartió por un canal equivocado: la vieja deja de
 * funcionar en el momento.
 */
export async function regenerarInvitacion(
  _estado: ResultadoEquipo,
  datos: FormData,
): Promise<ResultadoEquipo> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Solo el dueño del consultorio puede invitar.' }

  const id = String(datos.get('id') ?? '')
  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  const supabase = await createClient()

  await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id)

  const token = randomBytes(32).toString('base64url')
  const { error } = await supabase.from('invitations').insert({
    professional_id: profesional.id,
    email,
    role: 'assistant',
    token,
    expires_at: new Date(Date.now() + VIGENCIA_DIAS * 86_400_000).toISOString(),
  })

  if (error) return { error: traducir(error.message) }

  const avisoEnvio = await mandarInvitacion(email, profesional.name, token, profesional.email)

  revalidatePath('/admin/equipo')
  return {
    ok: avisoEnvio
      ? 'Liga nueva lista. La anterior dejó de servir.'
      : 'Liga nueva enviada por correo. La anterior dejó de servir.',
    token,
    avisoEnvio,
  }
}

export async function cancelarInvitacion(datos: FormData) {
  const { esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const supabase = await createClient()
  await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', String(datos.get('id')))

  revalidatePath('/admin/equipo')
}

export async function quitarAsistente(datos: FormData) {
  const { esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const supabase = await createClient()
  // RLS solo permite borrar membresías de asistentes, nunca la del dueño.
  await supabase.from('memberships').delete().eq('id', String(datos.get('id')))

  revalidatePath('/admin/equipo')
}

export async function aceptarInvitacion(
  _estado: ResultadoEquipo,
  datos: FormData,
): Promise<ResultadoEquipo> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('aceptar_invitacion', {
    p_token: String(datos.get('token') ?? ''),
  })

  if (error) return { error: traducir(error.message) }

  revalidatePath('/', 'layout')
  redirect('/admin')
}
