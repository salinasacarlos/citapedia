'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Marca } from '@/components/marca'
import { salir } from '@/lib/auth/actions'
import type { MemberRole } from '@/lib/database.types'

const SECCIONES = [
  { href: '/admin', etiqueta: 'Agenda' },
  { href: '/admin/solicitudes', etiqueta: 'Solicitudes' },
  { href: '/admin/pacientes', etiqueta: 'Pacientes' },
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

/** Cuántas esperan respuesta, junto a la sección donde se responden. */
function Insignia({ cuantas }: { cuantas: number }) {
  if (cuantas === 0) return null
  return (
    <span
      aria-label={`${cuantas} por revisar`}
      className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none font-bold text-white tabular-nums"
    >
      {cuantas > 99 ? '99+' : cuantas}
    </span>
  )
}

export function CabeceraAdmin({
  nombre,
  rol,
  foto,
  porRevisar = 0,
}: {
  nombre: string
  rol: MemberRole
  foto: string | null
  porRevisar?: number
}) {
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)
  const [cuenta, setCuenta] = useState(false)
  const zonaCuenta = useRef<HTMLDivElement>(null)

  const etiquetaRol = rol === 'owner' ? 'Dueño del consultorio' : 'Asistente'

  // Navegar cierra el menú: si no, queda tapando la pantalla a la que llegaste.
  useEffect(() => {
    setAbierto(false)
    setCuenta(false)
  }, [ruta])

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false)
        setCuenta(false)
      }
    }
    function alClicarFuera(e: MouseEvent) {
      if (zonaCuenta.current && !zonaCuenta.current.contains(e.target as Node)) {
        setCuenta(false)
      }
    }
    document.addEventListener('keydown', alPresionar)
    document.addEventListener('mousedown', alClicarFuera)
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.removeEventListener('mousedown', alClicarFuera)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Marca href="/admin" />

        {/* ---------- Escritorio: la foto abre el menú de cuenta ---------- */}
        <div ref={zonaCuenta} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setCuenta((v) => !v)}
            aria-expanded={cuenta}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-2"
          >
            <Avatar foto={foto} nombre={nombre} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-ink">{nombre}</span>
              <span className="block text-xs text-muted">{etiquetaRol}</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              className={`size-4 text-muted transition-transform ${cuenta ? 'rotate-180' : ''}`}
              fill="none"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {cuenta && (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-1 w-56 rounded-marca border border-border bg-surface p-1 shadow-lg"
            >
              <Link
                href="/admin/perfil"
                role="menuitem"
                className="block rounded-lg px-3 py-2 text-sm transition hover:bg-surface-2"
              >
                Mi página pública
              </Link>
              <Link
                href="/admin/cuenta"
                role="menuitem"
                className="block rounded-lg px-3 py-2 text-sm transition hover:bg-surface-2"
              >
                Mi cuenta
              </Link>
              <div className="my-1 border-t border-border" />
              <form action={salir}>
                <button
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-peligro transition hover:bg-peligro-suave"
                >
                  Salir
                </button>
              </form>
            </div>
          )}
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
                {s.href === '/admin/solicitudes' && <Insignia cuantas={porRevisar} />}
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
                  {s.href === '/admin/solicitudes' && <Insignia cuantas={porRevisar} />}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border px-2 py-2">
            <Link
              href="/admin/cuenta"
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
            >
              Mi cuenta
            </Link>
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
