import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MemberRole, Professional } from '@/lib/database.types'

export type Consultorio = {
  profesional: Professional
  rol: MemberRole
  /** El owner es el médico: solo él borra la cuenta e invita gente. */
  esDueño: boolean
}

/**
 * El consultorio del usuario en sesión. RLS ya garantiza que solo puede
 * devolver uno del que es miembro; esto solo evita repetir la consulta.
 */
export const obtenerConsultorio = cache(async (): Promise<Consultorio | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('memberships')
    .select('role, professionals(*)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle<{ role: MemberRole; professionals: Professional | null }>()

  if (!data?.professionals) return null

  return {
    profesional: data.professionals,
    rol: data.role,
    esDueño: data.role === 'owner',
  }
})

/** Para páginas de admin: sin consultorio no hay nada que mostrar. */
export async function exigirConsultorio(): Promise<Consultorio> {
  const consultorio = await obtenerConsultorio()
  if (!consultorio) redirect('/login')
  return consultorio
}
