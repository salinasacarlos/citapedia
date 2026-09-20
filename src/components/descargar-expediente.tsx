'use client'

import { useState } from 'react'
import { ConfirmarAccion } from '@/components/confirmar-accion'

type Hoja = { id: string; etiqueta: string; nota: string; clinica?: boolean }

/**
 * Las hojas son las mismas que arma el Excel. Se nombran por lo que contienen,
 * no por el nombre técnico de la hoja.
 */
const HOJAS: Hoja[] = [
  { id: 'Pacientes', etiqueta: 'Datos del paciente', nota: 'Contacto, tutor, seguro' },
  { id: 'Citas', etiqueta: 'Sus citas', nota: 'Fechas, estados y motivos' },
  {
    id: 'Expediente',
    etiqueta: 'Expediente clínico',
    nota: 'Alergias, padecimientos, antecedentes',
    clinica: true,
  },
  {
    id: 'Consultas',
    etiqueta: 'Notas de consulta',
    nota: 'Signos vitales, diagnósticos, tratamientos',
    clinica: true,
  },
  {
    id: 'Recetas',
    etiqueta: 'Lo recetado',
    nota: 'Medicamento, dosis, frecuencia, y si se retiró',
    clinica: true,
  },
]

/**
 * Preguntar qué llevarse.
 *
 * Antes bajaba todo siempre, y eso está mal en las dos direcciones: quien
 * quiere darle sus datos a un paciente no debería tener que entregarle también
 * las notas clínicas del médico, y quien quiere revisar unas fechas no necesita
 * abrir un archivo con el expediente completo dentro.
 */
export function DescargarExpediente({
  pacienteId,
  esDueño,
}: {
  pacienteId: string
  esDueño: boolean
}) {
  const disponibles = HOJAS.filter((h) => esDueño || !h.clinica)
  const [abierto, setAbierto] = useState(false)
  const [elegidas, setElegidas] = useState<string[]>(disponibles.map((h) => h.id))

  function alternar(id: string) {
    setElegidas((previas) =>
      previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id],
    )
  }

  function descargar() {
    const params = new URLSearchParams()
    for (const id of elegidas) params.append('hoja', id)
    setAbierto(false)
    // Una liga y no router.push: la ruta devuelve un archivo con
    // Content-Disposition, no una página que Next pueda navegar.
    const liga = document.createElement('a')
    liga.href = `/admin/pacientes/${pacienteId}/exportar?${params}`
    liga.click()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton boton-suave"
      >
        Descargar
      </button>

      <ConfirmarAccion
        abierto={abierto}
        titulo="¿Qué quieres descargar?"
        detalle={
          <div className="space-y-2">
            {disponibles.map((h) => (
              <label
                key={h.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-marca border border-border p-2.5 has-checked:border-brand/40 has-checked:bg-brand-suave/40"
              >
                <input
                  type="checkbox"
                  checked={elegidas.includes(h.id)}
                  onChange={() => alternar(h.id)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--brand-vivo)]"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{h.etiqueta}</span>
                  <span className="block text-xs text-muted">{h.nota}</span>
                </span>
              </label>
            ))}
            {esDueño && (
              <p className="pt-1 text-xs text-muted">
                Los estudios y documentos no van en el Excel: se descargan uno por
                uno desde su visor.
              </p>
            )}
          </div>
        }
        confirmar="Descargar"
        tono="normal"
        confirmarDeshabilitado={elegidas.length === 0}
        onCancelar={() => setAbierto(false)}
        onConfirmar={descargar}
      />
    </>
  )
}
