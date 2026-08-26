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

/**
 * Para páginas de admin.
 *
 * Sin sesión, el proxy ya redirigió a /login. Con sesión pero sin consultorio
 * —a un asistente le quitaron el acceso, por ejemplo— mandarlo a /login lo
 * dejaría rebotando: su sesión sigue siendo válida y volvería aquí. Va a una
 * pantalla que le explica qué pasó.
 */
export async function exigirConsultorio(): Promise<Consultorio> {
  const consultorio = await obtenerConsultorio()
  if (!consultorio) redirect('/sin-acceso')
  return consultorio
}
