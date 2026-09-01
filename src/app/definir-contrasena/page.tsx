import { Marca } from '@/components/marca'
import { createClient } from '@/lib/supabase/server'
import { DefinirContrasena } from '@/components/definir-contrasena'
import { obtenerConsultorio } from '@/lib/consultorio'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Define tu contraseña' }

export default async function DefinirContrasenaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Quien abre esta liga la recibió por WhatsApp de un tercero. Decirle a qué
  // cuenta pertenece es lo que le deja notar que le mandaron la del colega.
  const consultorio = user ? await obtenerConsultorio() : null

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

            <div className="mt-4 rounded-marca border border-border bg-fondo px-4 py-3">
              {consultorio && (
                <p className="font-semibold text-ink">{consultorio.profesional.name}</p>
              )}
              <p className="text-sm break-all text-muted">{user.email}</p>
              <p className="mt-1 text-xs text-muted">
                Si esta no es tu cuenta, no sigas: pide que te manden tu propia liga.
              </p>
            </div>
            <DefinirContrasena />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-ink">Esta liga ya no sirve</h1>
            <p className="mt-2 text-sm text-muted">
              Las ligas duran 48 horas y dejan de servir en cuanto se pone la
              contraseña. Pide otra a quien te dio de alta.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
