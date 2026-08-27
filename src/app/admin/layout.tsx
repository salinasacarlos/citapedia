import Link from 'next/link'
import { exigirConsultorio } from '@/lib/consultorio'
import { createClient } from '@/lib/supabase/server'
import { CabeceraAdmin } from '@/components/cabecera-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profesional, rol } = await exigirConsultorio()
  const supabase = await createClient()

  // Solo las que todavía se pueden aceptar: una solicitud cuyo horario ya pasó
  // no es trabajo pendiente, y contarla mandaría al médico a una lista donde
  // no hay nada que decidir.
  const { count: porRevisar } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'requested')
    .gte('starts_at', new Date().toISOString())

  return (
    <div className="min-h-dvh">
      <CabeceraAdmin
        nombre={profesional.name}
        rol={rol}
        foto={profesional.photo_url}
        porRevisar={porRevisar ?? 0}
      />

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
