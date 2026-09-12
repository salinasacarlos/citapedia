import { dominioPublico } from '@/lib/sitio'
import { CopiarLiga } from '@/components/copiar-liga'
import { exigirConsultorio } from '@/lib/consultorio'
import { createClient } from '@/lib/supabase/server'
import { CabeceraAdmin } from '@/components/cabecera-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profesional, rol } = await exigirConsultorio()
  // La corta, sin `www.`: es la que el médico lee en pantalla y la que dicta.
  // El apex redirige al www con 308, así que abre igual.
  const ligaPublica = `https://${dominioPublico()}/${profesional.slug}`
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

      {/*
        La liga que el médico más comparte. Abre en otra pestaña porque quien
        la revisa está a media tarea en el admin y no quiere perderla, y trae
        su botón de copiar: dictarla por teléfono o escribirla a mano es cómo
        se llega a un paciente en una página que no existe.
      */}
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-10 text-xs text-muted sm:px-6">
        <span>Tu página pública:</span>
        <a
          href={ligaPublica}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium break-all text-acento hover:underline"
        >
          {dominioPublico()}/{profesional.slug}
        </a>
        <CopiarLiga liga={ligaPublica} etiqueta="Copiar" compacto />
      </footer>
    </div>
  )
}
