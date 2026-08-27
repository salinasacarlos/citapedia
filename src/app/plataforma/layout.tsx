import Link from 'next/link'
import { Marca } from '@/components/marca'
import { exigirSuperadmin } from '@/lib/plataforma/acceso'
import { salir } from '@/lib/auth/actions'

export const metadata = { title: 'Plataforma' }

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await exigirSuperadmin()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Marca href="/plataforma" />
            {/* Que se note de un vistazo que aquí se ven cuentas ajenas. */}
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">
              Plataforma
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin" className="text-muted hover:text-foreground">
              Mi consultorio
            </Link>
            <form action={salir}>
              <button className="boton boton-suave px-3 py-1.5 text-xs">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}
