import Link from 'next/link'
import { exigirSuperadmin } from '@/lib/plataforma/acceso'
import { quitarPermiso } from '@/lib/plataforma/permisos'
import { DarPermiso } from '@/components/dar-permiso'
import { BotonQuitar } from '@/components/boton-quitar'
import { fechaCorta } from '@/lib/fechas'
import type { PlatformRole } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quién opera' }

type Operador = { email: string; rol: PlatformRole; note: string | null; desde: string }

export default async function Operadores() {
  const supabase = await exigirSuperadmin()
  const { esOperador } = supabase
  const { data } = await supabase.rpc('plataforma_operadores').returns<Operador[]>()
  const operadores = data ?? []

  return (
    <>
      <Link href="/plataforma" className="text-xs font-semibold text-acento hover:underline">
        ← Todos los consultorios
      </Link>

      <header className="mt-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Quién opera</h1>
        <p className="mt-1 text-sm text-muted">
          Esta escala no tiene nada que ver con la de los consultorios. Ser dueño de
          uno no da permiso aquí, y estar aquí no mete a nadie en ningún consultorio.
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="tarjeta p-4">
          <p className="font-semibold text-ink">Fundador</p>
          <p className="mt-1 text-sm text-muted">
            Ve todo y opera: suspende, reactiva, da de alta consultorios y reparte
            estos permisos.
          </p>
        </div>
        <div className="tarjeta p-4">
          <p className="font-semibold text-ink">Soporte</p>
          <p className="mt-1 text-sm text-muted">
            Ve la consola completa para poder ayudar, pero no cambia nada. Quien
            contesta el WhatsApp no tiene por qué poder apagarle el negocio a nadie.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {operadores.map((o) => (
          <li
            key={o.email}
            className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium break-all text-ink">
                {o.email}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    o.rol === 'fundador'
                      ? 'bg-brand-suave text-brand'
                      : 'bg-surface-2 text-muted'
                  }`}
                >
                  {o.rol === 'fundador' ? 'Fundador' : 'Soporte'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Desde {fechaCorta(o.desde, 'UTC')}
                {o.note && ` · ${o.note}`}
              </p>
            </div>
            {esOperador && (
              <form action={quitarPermiso} className="shrink-0">
                <input type="hidden" name="email" value={o.email} />
                <BotonQuitar etiqueta={`acceso de ${o.email}`} />
              </form>
            )}
          </li>
        ))}
      </ul>

      {esOperador && (
        <div className="mt-6">
          <DarPermiso />
        </div>
      )}
    </>
  )
}
