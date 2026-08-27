'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ResultadoDefinir = { error?: string }

/**
 * Pone la contraseña de quien llegó por una liga de acceso.
 *
 * No pide la anterior, al revés que el cambio desde /admin/cuenta: aquí la
 * credencial es la liga, que solo tiene quien abrió su propio correo. Pedirle
 * la contraseña de ahora a alguien que nunca tuvo una no llevaría a ningún lado.
 */
export async function definirContrasena(
  _estado: ResultadoDefinir,
  datos: FormData,
): Promise<ResultadoDefinir> {
  const contrasena = String(datos.get('password') ?? '')
  const repetida = String(datos.get('password2') ?? '')

  if (contrasena.length < 8) return { error: 'Usa al menos 8 caracteres.' }
  if (contrasena !== repetida) return { error: 'Las dos contraseñas no coinciden.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión es que la liga venció o ya se usó: no hay a quién cambiarle nada.
  if (!user) return { error: 'Esta liga ya no sirve. Pide una nueva.' }

  const { error } = await supabase.auth.updateUser({ password: contrasena })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/admin')
}
