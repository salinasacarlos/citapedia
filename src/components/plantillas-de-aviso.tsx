'use client'

import { useState } from 'react'
import { borrarPlantillaDeAviso, crearPlantillaDeAviso } from '@/lib/avisos/actions'
import { BASES } from '@/lib/avisos/bases'
import { Formulario } from '@/components/formulario'
import { BotonQuitar } from '@/components/boton-quitar'

export type PlantillaAviso = {
  id: string
  titulo: string
  mensaje: string | null
  base: string
  offset_meses: number
}

/** "A los 6 meses de su nacimiento" se lee mejor que "nacimiento + 6". */
export function describirPlantilla(p: { base: string; offset_meses: number }) {
  const desde = BASES.find((b) => b.valor === p.base)?.etiqueta ?? p.base
  if (p.offset_meses === 0) return `El día de ${desde}`
  if (p.offset_meses === 1) return `Al mes de ${desde}`
  if (p.offset_meses % 12 === 0) {
    const años = p.offset_meses / 12
    return `A ${años === 1 ? 'un año' : `los ${años} años`} de ${desde}`
  }
  return `A los ${p.offset_meses} meses de ${desde}`
}

/**
 * Los avisos que el consultorio repite.
 *
 * Un aviso suelto lleva una fecha; una plantilla lleva la **regla** para
 * calcularla, y esa es toda la diferencia: "a los 6 meses de nacido" sirve
 * para todos los pacientes, "el 15 de marzo" sirve para uno.
 *
 * Vive junto al recordatorio porque es la misma familia —los textos que el
 * consultorio manda— y porque las plantillas son del consultorio, no del
 * paciente que uno tenga abierto.
 */
export function PlantillasDeAviso({ plantillas }: { plantillas: PlantillaAviso[] }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <section className="tarjeta p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Avisos que repites</h2>
          <p className="mt-1 text-sm text-muted">
            Para no volver a escribir lo mismo en cada ficha. Se aplican desde el
            paciente, y la fecha se calcula sola.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          className="boton boton-suave px-3 py-1.5 text-xs"
        >
          {abierto ? 'Cerrar' : 'Nueva plantilla'}
        </button>
      </div>

      {abierto && (
        <Formulario
          accion={crearPlantillaDeAviso}
          enviar="Guardar plantilla"
          className="mt-4 border-b border-border pb-5"
          onExito={() => setAbierto(false)}
        >
          <div className="space-y-3">
            <input
              name="titulo"
              required
              maxLength={80}
              placeholder="Vacunas de los 6 meses"
              className="campo w-full"
            />
            <textarea
              name="mensaje"
              rows={2}
              maxLength={400}
              placeholder="Lo que quieres que diga el aviso (opcional)"
              className="campo w-full"
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">A los</span>
              <input
                name="offset_meses"
                type="number"
                min={0}
                max={240}
                defaultValue={6}
                required
                className="campo w-20 py-1.5"
              />
              <span className="text-muted">meses de</span>
              <select name="base" defaultValue="nacimiento" className="campo py-1.5">
                {BASES.map((b) => (
                  <option key={b.valor} value={b.valor}>
                    {b.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Formulario>
      )}

      {plantillas.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Todavía no tienes ninguna. El caso típico: un control que le dices a
          todos tus pacientes en el mismo momento de su vida.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {plantillas.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-marca border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{p.titulo}</p>
                <p className="text-xs text-muted">{describirPlantilla(p)}</p>
                {p.mensaje && <p className="mt-1 text-xs text-muted">{p.mensaje}</p>}
              </div>
              <form action={borrarPlantillaDeAviso}>
                <input type="hidden" name="id" value={p.id} />
                <BotonQuitar etiqueta={p.titulo} />
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
