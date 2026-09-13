'use client'

import { useState } from 'react'
import { guardarPlantillaRecordatorio } from '@/lib/admin/actions'
import { Formulario } from '@/components/formulario'
import { armarMensaje, conLiga, PLANTILLA_POR_DEFECTO, VARIABLES } from '@/lib/whatsapp'

/**
 * Lo que el paciente lee del consultorio entre que agenda y que llega.
 *
 * La vista previa no es adorno: la plantilla está llena de llaves y nadie
 * puede leer `Hola {paciente}` y saber cómo va a sonar. Escribir a ciegas es
 * como se manda un recordatorio que dice "a las 6:30 p.m.." con dos puntos, o
 * que saluda al niño cuando quien lee es su mamá.
 */
export function PlantillaRecordatorio({
  plantillaGuardada,
  doctor,
}: {
  plantillaGuardada: string | null
  doctor: string
}) {
  const [texto, setTexto] = useState(plantillaGuardada ?? PLANTILLA_POR_DEFECTO)

  // Ejemplo fijo y reconocible: se trata de ver el tono, no de adivinar datos.
  const ejemplo = armarMensaje(conLiga(texto), {
    paciente: 'Adriana',
    doctor,
    fecha: 'martes 15 de septiembre',
    hora: '10:00 a.m.',
    liga: 'citapedia.com/cita/…',
  })

  function insertar(variable: string) {
    setTexto((t) => `${t.trimEnd()} {${variable}}`.trim())
  }

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-semibold text-ink">El recordatorio que reciben</h2>
      <p className="mt-1 text-sm text-muted">
        Sale por correo el día antes, y es el mismo texto del botón de WhatsApp.
      </p>

      <Formulario accion={guardarPlantillaRecordatorio} enviar="Guardar recordatorio">
        <div className="mt-4">
          <textarea
            name="plantilla"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={600}
            className="campo w-full"
          />

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Insertar:</span>
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertar(v)}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-acento transition hover:bg-surface-2"
              >
                {`{${v}}`}
              </button>
            ))}
            {texto !== PLANTILLA_POR_DEFECTO && (
              <button
                type="button"
                onClick={() => setTexto(PLANTILLA_POR_DEFECTO)}
                className="ml-auto text-xs text-muted hover:text-ink hover:underline"
              >
                Volver al de siempre
              </button>
            )}
          </div>

          <div className="mt-4 rounded-marca border border-border bg-fondo p-3">
            <p className="text-xs font-medium text-muted">Así le llega al paciente</p>
            <p className="mt-1.5 text-sm break-words text-ink">{ejemplo}</p>
          </div>

          {!texto.includes('{liga}') && (
            <p className="mt-2 text-xs text-muted">
              Le agregamos la liga al final: es lo que deja al paciente confirmar
              solo, avisar si no puede y adelantar sus datos.
            </p>
          )}
        </div>
      </Formulario>
    </section>
  )
}
