import { Marca } from '@/components/marca'
import { createClient } from '@/lib/supabase/server'
import { DefinirContrasena } from '@/components/definir-contrasena'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Define tu contraseña' }

export default async function DefinirContrasenaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>

      <div className="tarjeta mt-8 p-6">
        {user ? (
          <>
            <h1 className="text-xl font-bold text-ink">Define tu contraseña</h1>
            <p className="mt-1 text-sm text-muted">
              Es la que vas a usar para entrar a tu consultorio. Nadie más la ve, ni
              nosotros.
            </p>
            <DefinirContrasena />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-ink">Esta liga ya no sirve</h1>
            <p className="mt-2 text-sm text-muted">
              Las ligas de acceso vencen y solo se pueden usar una vez. Pide otra a
              quien te dio de alta.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
