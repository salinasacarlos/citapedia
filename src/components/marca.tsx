import Link from 'next/link'

/**
 * Marca de CitaPedia.
 *
 * Esto es una reconstrucción en SVG del logo, para no depender de un binario
 * mientras se arma el producto: el arco abierto, la burbuja con la cruz y el
 * wordmark. Cuando tengas el archivo oficial (SVG de preferencia) déjalo en
 * `public/logo.svg` y lo cambiamos por el de verdad.
 */
export function Isotipo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} aria-hidden fill="none">
      {/* arco azul, abierto a la derecha */}
      <path
        d="M31 5a19 19 0 1 0 0 38"
        stroke="var(--acento)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* burbuja turquesa con la cola hacia abajo */}
      <path
        d="M40 6a17 17 0 0 1 0 34h-5l-8 9V23A17 17 0 0 1 40 6z"
        stroke="var(--brand-vivo)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M41 16v11M35.5 21.5h11"
        stroke="var(--brand-vivo)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark({ conTagline = false }: { conTagline?: boolean }) {
  return (
    <span className="inline-flex flex-col">
      <span className="text-xl font-extrabold tracking-tight text-ink">CitaPedia</span>
      {conTagline && (
        <span className="text-xs font-semibold text-brand">Cuidarlos es primero</span>
      )}
    </span>
  )
}

export function Marca({
  href = '/',
  conTagline = false,
  className = '',
}: {
  href?: string | null
  conTagline?: boolean
  className?: string
}) {
  const contenido = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Isotipo className={conTagline ? 'size-10' : 'size-8'} />
      <Wordmark conTagline={conTagline} />
    </span>
  )
  return href ? <Link href={href}>{contenido}</Link> : contenido
}
