'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { crearPacienteRapido, type ResultadoAgendar } from '@/lib/admin/agendar'
import { CampoTelefono } from '@/components/campo-telefono'
import { CampoOrigen } from '@/components/campo-origen'

export type PacienteBreve = {
  id: string
  name: string
  phone: string | null
  tutor_name: string | null
  tutor_phone: string | null
  is_minor: boolean | null
}

export function BuscarPaciente({
  resultados,
  hayBusqueda,
}: {
  resultados: PacienteBreve[]
  hayBusqueda: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [nuevo, setNuevo] = useState(false)
  const primerRender = useRef(true)

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    const t = setTimeout(() => {
      const nuevos = new URLSearchParams(params.toString())
      if (q) nuevos.set('q', q)
      else nuevos.delete('q')
      iniciar(() => router.replace(`/admin/agendar?${nuevos}`, { scroll: false }))
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  if (nuevo) return <PacienteNuevo nombreSugerido={q} onCancelar={() => setNuevo(false)} />

  return (
    <div>
      <label htmlFor="buscar-paciente" className="block text-sm font-medium text-ink">
        ¿Quién viene?
      </label>
      <input
        id="buscar-paciente"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Busca por nombre o teléfono"
        autoFocus
        className="campo mt-1.5"
      />

      <div className="mt-3">
        {pendiente ? (
          <p className="text-sm text-muted">Buscando…</p>
        ) : resultados.length > 0 ? (
          <ul className="space-y-2">
            {resultados.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/agendar?paciente=${p.id}`}
                  className="tarjeta flex flex-wrap items-center justify-between gap-3 p-3 transition hover:border-brand"
                >
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className="text-sm text-muted">
                    {p.is_minor && p.tutor_name
                      ? `${p.tutor_name} · ${p.tutor_phone ?? 'sin teléfono'}`
                      : (p.phone ?? 'sin teléfono')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : hayBusqueda ? (
          <p className="text-sm text-muted">Nadie con ese nombre o teléfono.</p>
        ) : (
          <p className="text-sm text-muted">
            Escribe para buscar entre tus pacientes.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setNuevo(true)}
        className="mt-4 text-sm font-semibold text-brand hover:underline"
      >
        + Es paciente nuevo
      </button>
    </div>
  )
}

function PacienteNuevo({
  nombreSugerido,
  onCancelar,
}: {
  nombreSugerido: string
  onCancelar: () => void
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoAgendar, FormData>(
    crearPacienteRapido,
    {},
  )
  const [paraOtro, setParaOtro] = useState(false)

  return (
    <form action={formAction}>
      <h2 className="font-semibold text-ink">Paciente nuevo</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Lo mínimo para agendar. El expediente se completa después.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={paraOtro}
              onChange={(e) => setParaOtro(e.target.checked)}
              className="size-4 accent-[var(--brand-vivo)]"
            />
            Depende de alguien (un menor, o alguien a cargo de un familiar)
          </label>
          <input type="hidden" name="is_minor" value={paraOtro ? '1' : '0'} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Nombre del paciente
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={nombreSugerido}
            className="campo mt-1.5"
          />
        </div>

        {paraOtro && (
          <>
            <div>
              <label htmlFor="tutor_name" className="block text-sm font-medium text-ink">
                ¿Quién responde por el paciente?
              </label>
              <input id="tutor_name" name="tutor_name" required className="campo mt-1.5" />
            </div>
            <div>
              <label
                htmlFor="tutor_relationship"
                className="block text-sm font-medium text-ink"
              >
                Parentesco
              </label>
              <input
                id="tutor_relationship"
                name="tutor_relationship"
                placeholder="Madre, padre, hijo…"
                className="campo mt-1.5"
              />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <CampoTelefono
            name="phone"
            label="Teléfono de WhatsApp"
            ayuda={
              paraOtro
                ? 'De quien responde: es a quien se le avisa.'
                : '10 dígitos, sin la lada del país.'
            }
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Correo <span className="font-normal text-muted">opcional</span>
          </label>
          <input id="email" name="email" type="email" className="campo mt-1.5" />
          <p className="mt-1 text-xs text-muted">
            {paraOtro
              ? 'De quien responde. Es a donde llega el recordatorio.'
              : 'Es a donde llega el recordatorio de su cita.'}
          </p>
        </div>

        <CampoOrigen />
      </div>

      {estado.error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {estado.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : 'Continuar'}
        </button>
        <button type="button" onClick={onCancelar} className="boton boton-suave">
          Buscar en su lugar
        </button>
      </div>
    </form>
  )
}
