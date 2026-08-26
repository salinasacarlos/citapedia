import Link from 'next/link'
import { exigirConsultorio } from '@/lib/consultorio'
import { CabeceraAdmin } from '@/components/cabecera-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profesional, rol } = await exigirConsultorio()

  return (
    <div className="min-h-dvh">
      <CabeceraAdmin nombre={profesional.name} rol={rol} foto={profesional.photo_url} />

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
