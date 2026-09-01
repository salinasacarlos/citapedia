import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ligaVigente } from '@/lib/acceso/ligas'

/**
 * Abre la liga de acceso: valida nuestro token y recién ahí le pide a Supabase
 * uno de un solo uso, que se canjea aquí mismo y nunca sale al navegador.
 *
 * Así la liga que anda por WhatsApp se puede abrir las veces que haga falta
 * —cada vez se arma una sesión nueva— y solo muere cuando se pone la
 * contraseña o cuando pasan las 48 horas.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { origin } = new URL(request.url)
  const { token } = await params

  // Sin la llave de servicio esta ruta no puede existir. Quien abre la liga no
  // tiene por qué ver una pantalla de error del servidor por eso.
  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.redirect(`${origin}/login?error=liga-invalida`)
  }

  const liga = await ligaVigente(token)
  if (!liga) return NextResponse.redirect(`${origin}/login?error=liga-invalida`)

  const admin = createAdminClient()
  const { data: enlace } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: liga.email,
  })
  const hash = enlace?.properties?.hashed_token
  if (!hash) return NextResponse.redirect(`${origin}/login?error=liga-invalida`)

  // Con el cliente de la petición, para que la sesión quede en sus cookies.
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: hash })
  if (error) return NextResponse.redirect(`${origin}/login?error=liga-invalida`)

  return NextResponse.redirect(`${origin}/definir-contrasena`)
}
