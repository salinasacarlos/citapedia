'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Solo rutas internas: un `next` con dominio ajeno convertiría el login en un
 * trampolín para mandar gente a sitios de terceros.
 */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = String(valor ?? '')
  return destino.startsWith('/') && !destino.startsWith('//') ? destino : '/admin'
}

export type EstadoFormulario = {
  error?: string
  aviso?: string
  /** Lo que ya había escrito, para no hacerle repetirlo tras un error. */
  valores?: Record<string, string>
}

const MENSAJES: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Falta confirmar tu correo. Revisa la liga que te mandamos.',
  'User already registered': 'Ese correo ya tiene cuenta. Entra en su lugar.',
  'Signups not allowed for this instance': 'El registro está cerrado por ahora.',
}

const PATRONES: [RegExp, string][] = [
  [/Email address .* is invalid/i, 'Ese correo no es válido. Revisa que esté bien escrito.'],
  [/Password should be at least/i, 'La contraseña necesita al menos 8 caracteres.'],
  [/rate limit|too many requests/i, 'Demasiados intentos seguidos. Espera un minuto.'],
  [/duplicate key .* professionals_email_key/i, 'Ese correo ya está usado por otro consultorio.'],
]

function traducir(mensaje: string) {
  if (MENSAJES[mensaje]) return MENSAJES[mensaje]
  for (const [patron, texto] of PATRONES) {
    if (patron.test(mensaje)) return texto
  }
  return mensaje
}

export async function registrar(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const name = String(datos.get('name') ?? '').trim()
  const specialty = String(datos.get('specialty') ?? '').trim()
  const destino = destinoSeguro(datos.get('next'))
  // Quien llega por invitación se engancha a un consultorio existente; el
  // trigger de alta no debe crearle uno propio.
  const esAsistente = datos.get('asistente') === '1'
  const email = String(datos.get('email') ?? '').trim()
  const password = String(datos.get('password') ?? '')

  // La contraseña nunca se devuelve al cliente.
  const valores = { name, specialty, email }

  if (!name) {
    return { error: 'Escribe tu nombre como quieres que lo vean tus pacientes.', valores }
  }
  if (password.length < 8) {
    return { error: 'La contraseña necesita al menos 8 caracteres.', valores }
  }

  const supabase = await createClient()
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El trigger on_auth_user_created lee esto para armar el consultorio.
      data: {
        name,
        specialty,
        signup_kind: esAsistente ? 'assistant' : 'professional',
      },
      emailRedirectTo: `${sitio}/auth/confirm?next=${encodeURIComponent(destino)}`,
    },
  })

  if (error) return { error: traducir(error.message), valores }

  // Con confirmación por correo activada, signUp no devuelve sesión.
  if (!data.session) {
    return { aviso: `Te mandamos una liga a ${email}. Ábrela para activar tu cuenta.` }
  }

  revalidatePath('/', 'layout')
  redirect(destino)
}

export async function entrar(
  _estado: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const email = String(datos.get('email') ?? '').trim()
  const destino = destinoSeguro(datos.get('next'))
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(datos.get('password') ?? ''),
  })

  if (error) return { error: traducir(error.message), valores: { email } }

  revalidatePath('/', 'layout')
  redirect(destino)
}

export async function salir() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
