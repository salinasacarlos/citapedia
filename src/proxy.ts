import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

/** Convención de Next 16 (antes `middleware`): corre antes de cada request. */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes: no hay sesión que refrescar ahí.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
