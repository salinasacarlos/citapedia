import Link from 'next/link'

/** Cambio entre la agenda como lista y como calendario. */
export function VistaAgenda({ actual }: { actual: 'lista' | 'calendario' }) {
  const opciones = [
    { id: 'lista', etiqueta: 'Lista', href: '/admin' },
    { id: 'calendario', etiqueta: 'Calendario', href: '/admin/calendario' },
  ] as const

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={o.href}
          aria-current={actual === o.id ? 'page' : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            actual === o.id ? 'bg-brand-vivo text-white' : 'text-muted hover:text-foreground'
          }`}
        >
          {o.etiqueta}
        </Link>
      ))}
    </div>
  )
}
