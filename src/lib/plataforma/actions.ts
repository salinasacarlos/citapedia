'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ResultadoPlataforma = {
  error?: string
  ok?: string
  /** Liga para que el médico ponga su contraseña. La plataforma nunca la ve. */
  liga?: string
}

/**
 * Suspender y reactivar pasan por funciones de la base que revisan
 * `es_superadmin()` y dejan constancia en `platform_audit`. Aquí no se decide
 * nada: si alguien llamara estas acciones sin ser operador, contesta la base.
 */
export async function suspenderConsultorio(
  _estado: ResultadoPlataforma,
  datos: FormData,
): Promise<ResultadoPlataforma> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('plataforma_suspender', {
    p_id: String(datos.get('id') ?? ''),
    p_motivo: String(datos.get('motivo') ?? ''),
  })

  if (error) return { error: error.message.replace(/^.*?:\s*/, '') }

  revalidatePath('/plataforma')
  return { ok: 'Cuenta suspendida.' }
}

export async function reactivarConsultorio(datos: FormData): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('plataforma_reactivar', { p_id: String(datos.get('id') ?? '') })
  revalidatePath('/plataforma')
}

/**
 * Da de alta un consultorio.
 *
 * Crear un usuario de auth necesita la llave de servicio, que salta RLS: por
 * eso lo primero es preguntarle a la base —con la sesión de quien pide, no con
 * la llave— si esa persona es operador. Sin ese paso, cualquiera con una sesión
 * podría llamar esta acción y crearse consultorios.
 *
 * El trigger `handle_new_user` arma el consultorio, su horario y sus ajustes a
 * partir de los metadatos, igual que en el registro normal.
 */
export async function crearConsultorio(
  _estado: ResultadoPlataforma,
  datos: FormData,
): Promise<ResultadoPlataforma> {
  const supabase = await createClient()
  const { data: operador } = await supabase.rpc('es_superadmin')
  if (operador !== true) return { error: 'No autorizado.' }

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  const nombre = String(datos.get('nombre') ?? '').trim()
  const especialidad = String(datos.get('especialidad') ?? '').trim()

  if (!email.includes('@')) return { error: 'Escribe un correo válido.' }
  if (nombre === '') return { error: 'Escribe el nombre del médico.' }

  // Falta de configuración, no choque: sin la llave de servicio esta acción no
  // puede existir, y decirlo aquí evita mandar al operador a los logs.
  if (!process.env.SUPABASE_SECRET_KEY) {
    return {
      error:
        'Falta SUPABASE_SECRET_KEY en este entorno. Crear cuentas necesita la ' +
        'llave de servicio de Supabase.',
    }
  }

  const admin = createAdminClient()

  // Sin contraseña: se crea la cuenta y el médico elige la suya con la liga.
  // Una contraseña temporal tendría que viajar por algún lado, y ese lado
  // siempre resulta ser WhatsApp.
  const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: nombre, specialty: especialidad || null, signup_kind: 'professional' },
  })

  if (errorAlta || !creado.user) {
    const m = errorAlta?.message ?? ''
    if (m.toLowerCase().includes('already')) {
      return { error: 'Ya hay una cuenta con ese correo.' }
    }
    return { error: m || 'No se pudo crear la cuenta.' }
  }

  const { data: consultorio } = await admin
    .from('professionals')
    .select('id, name')
    .eq('email', email)
    .maybeSingle<{ id: string; name: string }>()

  await supabase.rpc('plataforma_anotar', {
    p_action: 'alta',
    p_target: consultorio?.id ?? null,
    p_detail: `${nombre} · ${email}`,
  })

  // La liga se arma con el token, no con el `action_link` de Supabase: así
  // pasa por nuestra propia ruta de confirmación, que ya sabe filtrar destinos.
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const token = enlace?.properties?.hashed_token

  revalidatePath('/plataforma')

  if (!token) {
    return {
      ok: `Consultorio creado para ${nombre}.`,
      error: 'No se pudo generar la liga de acceso; genera una desde Supabase.',
    }
  }

  return {
    ok: `Consultorio creado para ${nombre}.`,
    liga: `${sitio}/auth/confirm?token_hash=${token}&type=recovery&next=%2Fdefinir-contrasena`,
  }
}
