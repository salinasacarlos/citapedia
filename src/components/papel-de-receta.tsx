'use client'

import { useRef, useState } from 'react'
import {
  guardarMargenesDeReceta,
  quitarPapelDeReceta,
  subirPapelDeReceta,
} from '@/lib/receta/actions'
import { Formulario } from '@/components/formulario'

export type PapelDeRecetaGuardado = {
  mime: string
  margen_arriba: number
  margen_abajo: number
  updated_at: string
}

/**
 * El papel membretado con el que el consultorio imprime sus recetas.
 *
 * No se genera un diseño nuestro: lo que hace válida una receta —cédula,
 * domicilio, firma— ya está en el papel del médico, y es justo lo que
 * CitaPedia no puede afirmar. Aquí solo se guarda el suyo y se marca dónde
 * puede escribir encima.
 */
export function PapelDeReceta({ papel }: { papel: PapelDeRecetaGuardado | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [pesado, setPesado] = useState<string | null>(null)

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Tu papel de recetas</h2>
      <p className="mt-1 text-sm text-muted">
        Sube el membretado que ya usas —con tu cédula y tu firma— y CitaPedia
        escribe encima los medicamentos de cada consulta, para imprimirla.
      </p>

      <Formulario accion={subirPapelDeReceta} enviar="Guardar" className="mt-4">
        <input
          ref={inputRef}
          type="file"
          name="papel"
          accept="application/pdf,image/png,image/jpeg"
          className="campo w-full text-sm"
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo && archivo.size > 5 * 1024 * 1024) {
              setPesado(`Pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo son 5 MB.`)
              e.target.value = ''
              return
            }
            setPesado(null)
          }}
        />
        <p className="mt-1 text-xs text-muted">PDF, PNG o JPG. Máximo 5 MB.</p>
        {pesado && <p className="mt-1 text-sm text-peligro">{pesado}</p>}
      </Formulario>

      {papel && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs text-muted">
            Cargado el {new Date(papel.updated_at).toLocaleDateString('es-MX')} ·{' '}
            {papel.mime === 'application/pdf' ? 'PDF' : 'Imagen'}
          </p>

          <p className="mt-3 text-sm text-ink">¿Cuánto espacio hay que respetarle?</p>
          <p className="text-xs text-muted">
            Mide con una regla tu hoja impresa: hasta dónde llega el encabezado, y
            desde dónde empieza lo de abajo. Ahí es donde va tu firma.
          </p>

          <form ref={formRef} className="mt-3">
            <Formulario accion={guardarMargenesDeReceta} enviar="Guardar márgenes">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="margen_arriba" className="text-muted">
                  Arriba
                </label>
                <input
                  id="margen_arriba"
                  name="margen_arriba"
                  type="number"
                  min={0}
                  max={200}
                  required
                  defaultValue={papel.margen_arriba}
                  className="campo w-20 py-1.5"
                />
                <span className="text-muted">mm</span>
                <label htmlFor="margen_abajo" className="ml-3 text-muted">
                  Abajo
                </label>
                <input
                  id="margen_abajo"
                  name="margen_abajo"
                  type="number"
                  min={0}
                  max={200}
                  required
                  defaultValue={papel.margen_abajo}
                  className="campo w-20 py-1.5"
                />
                <span className="text-muted">mm</span>
              </div>
            </Formulario>
          </form>

          <form action={quitarPapelDeReceta} className="mt-3">
            <button className="text-xs text-muted hover:text-peligro hover:underline">
              Quitar el papel
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
