'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECCIONES = [
  { href: '/admin', etiqueta: 'Agenda' },
  { href: '/admin/solicitudes', etiqueta: 'Solicitudes' },
  { href: '/admin/horario', etiqueta: 'Horario' },
  { href: '/admin/historial', etiqueta: 'Historial' },
  { href: '/admin/perfil', etiqueta: 'Mi página' },
  { href: '/admin/equipo', etiqueta: 'Equipo' },
]

export function NavAdmin() {
  const ruta = usePathname()

  // Scroll de borde a borde en móvil: sin los márgenes negativos, la última
  // pestaña queda cortada contra el padding del contenedor.

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SECCIONES.map((seccion) => {
        const activa =
          seccion.href === '/admin' ? ruta === '/admin' : ruta.startsWith(seccion.href)
        return (
          <Link
            key={seccion.href}
            href={seccion.href}
            aria-current={activa ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
              activa
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {seccion.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
