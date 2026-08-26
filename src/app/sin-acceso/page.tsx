import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obtenerConsultorio } from '@/lib/consultorio'
import { salir } from '@/lib/auth/actions'
import { Marca } from '@/components/marca'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sin acceso' }

export default async function SinAccesoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  // Si recuperó el acceso, no tiene por qué quedarse aquí.
  if (await obtenerConsultorio()) redirect('/admin')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>

      <div className="tarjeta mt-8 p-6 text-center">
        <h1 className="text-xl font-bold text-ink">Tu cuenta no tiene consultorio</h1>
        <p className="mt-3 text-sm text-muted">
          Entraste como <strong className="font-medium break-all">{user.email}</strong>,
          pero esta cuenta no pertenece a ningún consultorio ahora mismo.
        </p>
        <p className="mt-2 text-sm text-muted">
          Puede que te hayan quitado el acceso, o que la invitación todavía no se
          haya aceptado. Si esperas una invitación, ábrela desde la liga que te
          mandaron.
        </p>

        <div className="mt-6 space-y-2">
          <Link href="/registro" className="boton boton-primario w-full">
            Crear mi propio consultorio
          </Link>
          <form action={salir}>
            <button className="boton boton-suave w-full">Salir</button>
          </form>
        </div>
      </div>
    </main>
  )
}
