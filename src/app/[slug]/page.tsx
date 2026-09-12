import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cargarPaginaPublica, huecosDe } from '@/lib/publico/datos'
import { Reservar } from '@/components/reservar'
import { Marca } from '@/components/marca'
import { TextoExpandible } from '@/components/texto-expandible'
import { enTextoPlano } from '@/lib/texto-rico'
import { nombreDePila } from '@/lib/fechas'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const datos = await cargarPaginaPublica(slug)
  if (!datos) return { title: 'Consultorio no encontrado' }

  const { perfil } = datos
  const titulo = `${perfil.name}${perfil.specialty ? ` · ${perfil.specialty}` : ''}`
  // La bio está en Markdown: sin aplanarla, la vista previa de WhatsApp sale
  // con los asteriscos crudos, que es justo lo que hace parecer spam una liga.
  const descripcion = perfil.bio
    ? enTextoPlano(perfil.bio)
    : `Agenda tu cita con ${perfil.name} en CitaPedia.`

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: 'profile',
      // El título de OG lleva la marca porque ahí no hay plantilla que la
      // agregue, al revés que el `<title>` de la pestaña.
      title: `${titulo} · CitaPedia`,
      description: descripcion,
      url: `/${slug}`,
      siteName: 'CitaPedia',
      locale: 'es_MX',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion },
  }
}

export default async function PaginaPublica({ params }: Props) {
  const { slug } = await params
  const datos = await cargarPaginaPublica(slug)
  if (!datos) notFound()

  const { perfil } = datos
  const dias = huecosDe(datos)

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Marca href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          {perfil.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.photo_url}
              alt={perfil.name}
              className="size-20 shrink-0 rounded-2xl object-cover sm:size-24"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-suave text-3xl font-bold text-brand sm:size-24"
            >
              {nombreDePila(perfil.name).charAt(0)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-balance text-ink sm:text-3xl">
              {perfil.name}
            </h1>
            {perfil.specialty && <p className="mt-1 text-brand font-semibold">{perfil.specialty}</p>}
            {(perfil.clinic_address || perfil.phone) && (
              <p className="mt-2 text-sm text-muted">
                {[perfil.clinic_address, perfil.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </section>

        {perfil.bio && (
          <section className="mt-8">
            <h2 className="font-bold text-ink">Sobre {nombreDePila(perfil.name)}</h2>
            {/* Quien llega aquí viene a agendar: un texto largo no debe empujar
                el calendario fuera de la pantalla. */}
            <TextoExpandible
              texto={perfil.bio}
              className="mt-2 leading-relaxed text-muted"
            />
          </section>
        )}

        {perfil.consultation_info && (
          <section className="tarjeta mt-6 p-5">
            <h2 className="font-bold text-ink">Antes de tu visita</h2>
            <TextoExpandible
              texto={perfil.consultation_info}
              className="mt-2 text-sm leading-relaxed text-muted"
            />
          </section>
        )}

        <hr className="my-10 border-border" />

        <Reservar
          slug={perfil.slug}
          medico={perfil.name}
          zona={perfil.timezone}
          dias={dias}
        />
      </main>

      <footer className="mx-auto max-w-3xl px-4 py-10 text-center text-xs text-muted sm:px-6">
        Agenda gestionada con CitaPedia.
      </footer>
    </div>
  )
}
