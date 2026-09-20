'use client'

import Link from 'next/link'
import { useState } from 'react'
import { recetarMedicamento, retirarMedicamento } from '@/lib/recetas/actions'
import { Formulario } from '@/components/formulario'
import { fechaSuelta } from '@/lib/fechas'

export type Receta = {
  id: string
  medicamento: string
  dosis: string | null
  frecuencia: string | null
  duracion: string | null
  indicaciones: string | null
  cuando: string
  retirada: boolean
}

/** "250 mg · cada 8 horas · 7 días", saltándose lo que no se capturó. */
function renglon(r: Receta) {
  return [r.dosis, r.frecuencia, r.duracion].filter(Boolean).join(' · ')
}

/**
 * Lo recetado en esta consulta.
 *
 * Complementa el tratamiento en texto libre, **no lo sustituye**: el médico
 * sigue escribiendo ahí lo que quiera. Esto es para lo que después hay que
 * poder buscar — qué se le dio, cuánto y por cuánto tiempo.
 *
 * Una receta no se corrige encima: se retira y se escribe la correcta, y las
 * dos quedan a la vista. Es la misma exigencia que la NOM-004 le pone a la
 * nota, resuelta sin una segunda tabla de historial.
 */
export function Recetas({
  notaId,
  citaId,
  pacienteId,
  recetas,
  hayPapel = false,
}: {
  notaId: string | null
  citaId: string
  pacienteId: string
  recetas: Receta[]
  /** Sin papel membretado no se imprime: le faltaría la cédula y la firma. */
  hayPapel?: boolean
}) {
  const [abierto, setAbierto] = useState(false)

  const vigentes = recetas.filter((r) => !r.retirada)
  const retiradas = recetas.filter((r) => r.retirada)

  return (
    <section className="tarjeta p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Lo que le receté</h3>
          <p className="text-xs text-muted">
            Aparte del tratamiento que escribas arriba, con sus datos por separado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {vigentes.length > 0 && hayPapel && (
            <a
              href={`/admin/consulta/${citaId}/receta`}
              target="_blank"
              rel="noopener noreferrer"
              className="boton boton-primario px-3 py-1 text-xs"
            >
              Imprimir receta
            </a>
          )}
          {notaId && !abierto && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="boton boton-suave px-3 py-1 text-xs"
            >
              Agregar
            </button>
          )}
        </div>
      </div>

      {vigentes.length > 0 && !hayPapel && (
        <p className="mt-3 text-xs text-muted">
          Para imprimirla necesitas cargar tu papel membretado en{' '}
          <Link href="/admin/horario" className="text-acento hover:underline">
            Tu consultorio
          </Link>
          . Sin él, la hoja no llevaría tu cédula ni tu firma.
        </p>
      )}

      {!notaId && (
        <p className="mt-3 text-xs text-muted">
          Guarda la consulta primero: el medicamento se anota dentro de ella.
        </p>
      )}

      {abierto && notaId && (
        <Formulario
          accion={recetarMedicamento}
          enviar="Agregar"
          className="mt-3 border-b border-border pb-4"
          onExito={() => setAbierto(false)}
        >
          <input type="hidden" name="nota" value={notaId} />
          <input type="hidden" name="cita" value={citaId} />
          <input type="hidden" name="paciente" value={pacienteId} />

          <div className="space-y-2">
            <input
              name="medicamento"
              required
              maxLength={120}
              placeholder="Medicamento"
              className="campo w-full"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <input name="dosis" maxLength={60} placeholder="250 mg" className="campo" />
              <input
                name="frecuencia"
                maxLength={60}
                placeholder="cada 8 horas"
                className="campo"
              />
              <input name="duracion" maxLength={60} placeholder="7 días" className="campo" />
            </div>
            <input
              name="indicaciones"
              maxLength={200}
              placeholder="Con alimentos, suspender si hay rash…"
              className="campo w-full"
            />
          </div>
        </Formulario>
      )}

      {recetas.length === 0 ? (
        notaId && <p className="mt-3 text-xs text-muted">Todavía no has anotado ninguno.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {vigentes.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{r.medicamento}</p>
                {renglon(r) && <p className="text-xs text-muted">{renglon(r)}</p>}
                {r.indicaciones && <p className="text-xs text-muted">{r.indicaciones}</p>}
              </div>
              <form action={retirarMedicamento}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="cita" value={citaId} />
                <input type="hidden" name="paciente" value={pacienteId} />
                <button className="text-xs text-muted hover:text-peligro hover:underline">
                  Retirar
                </button>
              </form>
            </li>
          ))}

          {retiradas.length > 0 && (
            <li className="border-t border-border pt-2">
              <p className="text-xs text-muted">Retirados</p>
              <ul className="mt-1 space-y-1">
                {retiradas.map((r) => (
                  <li key={r.id} className="text-xs text-muted line-through">
                    {r.medicamento} {renglon(r) && `· ${renglon(r)}`}{' '}
                    <span className="no-underline">({fechaSuelta(r.cuando.slice(0, 10))})</span>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
