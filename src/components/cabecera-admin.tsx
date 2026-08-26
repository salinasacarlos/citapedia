'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Marca } from '@/components/marca'
import { salir } from '@/lib/auth/actions'
import type { MemberRole } from '@/lib/database.types'

const SECCIONES = [
  { href: '/admin', etiqueta: 'Agenda' },
  { href: '/admin/solicitudes', etiqueta: 'Solicitudes' },
  { href: '/admin/horario', etiqueta: 'Horario' },
  { href: '/admin/historial', etiqueta: 'Historial' },
  { href: '/admin/perfil', etiqueta: 'Mi página' },
  { href: '/admin/equipo', etiqueta: 'Equipo' },
] as const

function esActiva(ruta: string, href: string) {
  return href === '/admin' ? ruta === '/admin' : ruta.startsWith(href)
}

function Hamburguesa({ abierto }: { abierto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" strokeWidth="2" aria-hidden>
      {abierto ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" />
      )}
    </svg>
  )
}

/** Foto del médico, o su inicial si todavía no sube una. */
function Avatar({ foto, nombre }: { foto: string | null; nombre: string }) {
  const inicial = nombre.replace(/^(dr|dra)\.?\s*/i, '').charAt(0).toUpperCase()

  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-suave text-sm font-bold text-brand"
    >
      {inicial}
    </span>
  )
}

export function CabeceraAdmin({
  nombre,
  rol,
  foto,
}: {
  nombre: string
  rol: MemberRole
  foto: string | null
}) {
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)

  const etiquetaRol = rol === 'owner' ? 'Dueño del consultorio' : 'Asistente'

  // Navegar cierra el menú: si no, queda tapando la pantalla a la que llegaste.
  useEffect(() => {
    setAbierto(false)
  }, [ruta])

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Marca href="/admin" />

        {/* ---------- Escritorio ---------- */}
        {/* La foto y el nombre son el acceso al perfil, no un menú: es donde
            la gente ya busca sus datos. Salir queda a la vista, sin esconderse
            detrás de un clic extra. */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/admin/perfil"
            aria-label="Editar mi página"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-2"
          >
            <Avatar foto={foto} nombre={nombre} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-ink">{nombre}</span>
              <span className="block text-xs text-muted">{etiquetaRol}</span>
            </span>
          </Link>
          <form action={salir}>
            <button className="boton boton-suave px-3 py-1.5 text-xs">Salir</button>
          </form>
        </div>

        {/* ---------- Móvil: hamburguesa ---------- */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-admin"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          className="boton boton-suave px-2.5 py-2 md:hidden"
        >
          <Hamburguesa abierto={abierto} />
        </button>
      </div>

      {/* ---------- Escritorio: pestañas ---------- */}
      <div className="mx-auto hidden max-w-5xl px-6 md:block">
        <nav className="flex gap-1">
          {SECCIONES.map((s) => {
            const activa = esActiva(ruta, s.href)
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                  activa
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {s.etiqueta}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ---------- Móvil: el menú desplegado ---------- */}
      {abierto && (
        <div id="menu-admin" className="border-t border-border md:hidden">
          <Link href="/admin/perfil" className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
            <Avatar foto={foto} nombre={nombre} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{nombre}</span>
              <span className="block text-xs text-muted">{etiquetaRol} · editar mi página</span>
            </span>
          </Link>

          <nav className="border-t border-border px-2 py-2">
            {SECCIONES.map((s) => {
              const activa = esActiva(ruta, s.href)
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={activa ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    activa ? 'bg-brand-suave text-brand' : 'text-foreground hover:bg-surface-2'
                  }`}
                >
                  {s.etiqueta}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border px-2 py-2">
            <form action={salir}>
              <button className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-peligro transition hover:bg-peligro-suave">
                Salir
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
