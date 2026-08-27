import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'
import { supabaseEnv } from './env'

/**
 * Refresca el token de sesión en cada request y lo reescribe en las cookies.
 * Sin esto, los Server Components ven sesiones vencidas: ellos pueden leer
 * cookies pero no escribirlas.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { url, publishableKey } = supabaseEnv()
  // Sin configurar todavía: dejamos pasar en vez de tirar toda la app.
  if (!url || !publishableKey) return response

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Importante: getUser() valida contra el servidor de auth y dispara el
  // refresh. No lo cambies por getSession(), que solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // El admin es del consultorio y /plataforma es la consola de operación:
  // sin sesión, a la puerta las dos.
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/plataforma'))
  ) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(login)
  }

  return response
}
