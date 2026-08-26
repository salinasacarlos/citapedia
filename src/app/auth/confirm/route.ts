import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Destino de la liga que llega por correo. Supabase manda `token_hash` para
 * confirmaciones de email y `code` para los flujos PKCE; aceptamos ambos.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const destino = searchParams.get('next') ?? '/admin'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${destino}`)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${destino}`)
  }

  return NextResponse.redirect(`${origin}/login?error=liga-invalida`)
}
