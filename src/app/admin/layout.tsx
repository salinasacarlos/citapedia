import Link from 'next/link'
import { exigirConsultorio } from '@/lib/consultorio'
import { salir } from '@/lib/auth/actions'
import { Marca } from '@/components/marca'
import { NavAdmin } from '@/components/nav-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profesional, rol } = await exigirConsultorio()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <Marca href="/admin" />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{profesional.name}</p>
              <p className="text-xs text-muted">
                {rol === 'owner' ? 'Dueño del consultorio' : 'Asistente'}
              </p>
            </div>
            <form action={salir}>
              <button className="boton boton-suave px-3 py-1.5 text-xs">Salir</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <NavAdmin />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs break-all text-muted sm:px-6">
        Tu página pública:{' '}
        <Link href={`/${profesional.slug}`} className="font-medium text-acento hover:underline">
          citapedia.com/{profesional.slug}
        </Link>
      </footer>
    </div>
  )
}
