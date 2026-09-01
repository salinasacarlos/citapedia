import 'server-only'
import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 48 horas. La liga se manda por WhatsApp a alguien que casi siempre está en
 * consulta: una hora significaba mandarla y quedarse esperando a que la abriera.
 */
export const VIGENCIA_HORAS = 48

export type Grant = { id: string; user_id: string; email: string }

/**
 * Arma una liga nueva y mata las anteriores que no se hayan usado.
 *
 * Matar las viejas es lo que hace que "genera otra" signifique algo: si
 * convivieran, la que quedó en un chat de hace tres días seguiría entrando.
 */
export async function crearLigaDeAcceso(userId: string, email: string, creadaPor?: string) {
  const admin = createAdminClient()
  const token = randomBytes(32).toString('hex')

  await admin
    .from('access_grants')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  const expira = new Date(Date.now() + VIGENCIA_HORAS * 3600 * 1000)
  const { error } = await admin.from('access_grants').insert({
    user_id: userId,
    email,
    token,
    created_by: creadaPor ?? null,
    expires_at: expira.toISOString(),
  })

  if (error) return { error: error.message }
  return { token }
}

/** La liga sigue viva mientras no se haya usado y no haya vencido. */
export async function ligaVigente(token: string): Promise<Grant | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('access_grants')
    .select('id, user_id, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle<Grant & { expires_at: string; used_at: string | null }>()

  if (!data || data.used_at) return null
  if (new Date(data.expires_at) < new Date()) return null
  return { id: data.id, user_id: data.user_id, email: data.email }
}

/**
 * Se marca al PONER la contraseña, no al abrir la liga: quien la abre, la mira
 * y se va a pensar una contraseña tiene que poder volver.
 */
export async function marcarLigaUsada(userId: string) {
  const admin = createAdminClient()
  await admin
    .from('access_grants')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)
}
