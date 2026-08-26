'use client'

import { useActionState, useRef, useState } from 'react'
import { borrarEstudio, subirEstudio, type ResultadoEstudio } from '@/lib/estudios/actions'
import { BotonQuitar } from '@/components/boton-quitar'
import { fechaCorta } from '@/lib/fechas'

export type EstudioVisible = {
  id: string
  filename: string
  kind: string | null
  mime: string
  size_bytes: number
  created_at: string | null
  /** Liga firmada, generada en el servidor: el bucket es privado. */
  url: string | null
}

const TIPOS_SUGERIDOS = ['Laboratorio', 'Estudio de imagen', 'Receta', 'Referencia']

function peso(bytes: number) {
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function Estudios({
  pacienteId,
  citaId,
  estudios,
  zona,
}: {
  pacienteId: string
  citaId?: string
  estudios: EstudioVisible[]
  zona: string
}) {
  const [estado, formAction, pendiente] = useActionState<ResultadoEstudio, FormData>(
    subirEstudio,
    {},
  )
  const [nombre, setNombre] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  return (
    <div className="@container">
      <form
        action={(datos) => {
          formAction(datos)
          setNombre(null)
          entrada.current?.form?.reset()
        }}
        className="rounded-marca border border-dashed border-border p-3"
      >
        <input type="hidden" name="patient_id" value={pacienteId} />
        {citaId && <input type="hidden" name="appointment_id" value={citaId} />}

        <div className="flex flex-col gap-2 @md:flex-row @md:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`archivo-${citaId ?? pacienteId}`}
              className="block text-xs text-muted"
            >
              Estudio, laboratorio o documento
            </label>
            <input
              ref={entrada}
              id={`archivo-${citaId ?? pacienteId}`}
              name="archivo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={(e) => setNombre(e.currentTarget.files?.[0]?.name ?? null)}
              className="campo mt-1 file:mr-3 file:rounded-full file:border-0 file:bg-brand-suave file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand"
            />
          </div>
          <div className="@md:w-44">
            <label
              htmlFor={`kind-${citaId ?? pacienteId}`}
              className="block text-xs text-muted"
            >
              ¿Qué es? <span className="opacity-60">opcional</span>
            </label>
            <input
              id={`kind-${citaId ?? pacienteId}`}
              name="kind"
              list="tipos-de-estudio"
              placeholder="Laboratorio"
              className="campo mt-1"
            />
            <datalist id="tipos-de-estudio">
              {TIPOS_SUGERIDOS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <button
            disabled={pendiente || !nombre}
            className="boton boton-primario px-3 py-1.5 text-xs"
          >
            {pendiente ? 'Subiendo…' : 'Agregar'}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted">
          Imágenes o PDF, hasta 20 MB. Solo tú los ves.
        </p>

        {estado.error && (
          <p role="alert" className="mt-2 text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="mt-2 text-sm text-exito">
            {estado.ok}
          </p>
        )}
      </form>

      {estudios.length > 0 && (
        <ul className="mt-3 space-y-2">
          {estudios.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-marca border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={e.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-acento hover:underline"
                >
                  <span aria-hidden>{e.mime === 'application/pdf' ? '📄' : '🖼️'}</span>{' '}
                  {e.filename}
                </a>
                <p className="mt-0.5 text-xs text-muted">
                  {e.kind && <span className="text-brand">{e.kind} · </span>}
                  {peso(e.size_bytes)}
                  {e.created_at && ` · ${fechaCorta(e.created_at, zona)}`}
                </p>
              </div>
              <form action={borrarEstudio} className="shrink-0">
                <input type="hidden" name="id" value={e.id} />
                <BotonQuitar etiqueta={e.filename} />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
