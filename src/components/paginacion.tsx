import Link from 'next/link'

export function Paginacion({
  ruta,
  params,
  pagina,
  total,
  porPagina,
}: {
  ruta: string
  params: Record<string, string | string[] | undefined>
  pagina: number
  total: number
  porPagina: number
}) {
  const paginas = Math.ceil(total / porPagina)
  if (paginas <= 1) return null

  const liga = (n: number) => {
    const busqueda = new URLSearchParams()
    for (const [clave, valor] of Object.entries(params)) {
      const v = Array.isArray(valor) ? valor[0] : valor
      if (v && clave !== 'pagina') busqueda.set(clave, v)
    }
    if (n > 1) busqueda.set('pagina', String(n))
    const cadena = busqueda.toString()
    return cadena ? `${ruta}?${cadena}` : ruta
  }

  return (
    <nav className="mt-6 flex items-center justify-between gap-4 text-sm" aria-label="Paginación">
      {pagina > 1 ? (
        <Link href={liga(pagina - 1)} className="boton boton-suave">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={liga(pagina + 1)} className="boton boton-suave">
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
