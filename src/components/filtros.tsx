'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

export type OpcionEstado = { valor: string; etiqueta: string }

/**
 * Barra de filtros. Escribe en la URL, no en estado local: la lista la sigue
 * armando el servidor, así que funciona el botón atrás y la búsqueda se puede
 * compartir tal cual.
 */
export function Filtros({
  ruta,
  estados,
  conFechas = true,
  placeholder = 'Buscar por nombre, teléfono o correo',
  etiquetaEstado = 'Desenlace',
  etiquetaTodos = 'Todos',
}: {
  ruta: string
  estados?: OpcionEstado[]
  /** En vistas ya acotadas a un periodo, el rango de fechas sobra. */
  conFechas?: boolean
  placeholder?: string
  /** Cómo se llama aquí lo que el select filtra. */
  etiquetaEstado?: string
  /**
   * Qué dice la opción vacía. En el Historial es "Todos"; en Solicitudes lo
   * que no está filtrado es lo que espera decisión, y decirle "Todos" mentiría.
   */
  etiquetaTodos?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()

  const [q, setQ] = useState(params.get('q') ?? '')
  const primerRender = useRef(true)

  function navegar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    // Cualquier cambio de filtro devuelve a la primera página.
    nuevos.delete('pagina')
    iniciar(() => router.replace(`${ruta}?${nuevos}`, { scroll: false }))
  }

  // La búsqueda espera a que dejes de escribir; los demás filtros no lo necesitan.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    const t = setTimeout(() => navegar({ q }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const desde = params.get('desde') ?? ''
  const hasta = params.get('hasta') ?? ''
  const estado = params.get('estado') ?? ''
  const activos = Boolean(q || desde || hasta || estado)


  return (
    <div className="tarjeta mb-5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={conFechas ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-4'}>
          <label htmlFor="q" className="block text-xs font-medium text-muted">
            Buscar
          </label>
          <input
            id="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="campo mt-1"
          />
        </div>

        {conFechas && (
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2 lg:grid-cols-2">
          <div>
            <label htmlFor="desde" className="block text-xs font-medium text-muted">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => navegar({ desde: e.target.value })}
              className="campo mt-1"
            />
          </div>
          <div>
            <label htmlFor="hasta" className="block text-xs font-medium text-muted">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => navegar({ hasta: e.target.value })}
              className="campo mt-1"
            />
          </div>
        </div>
        )}

        {estados && (
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="estado" className="block text-xs font-medium text-muted">
              {etiquetaEstado}
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => navegar({ estado: e.target.value })}
              className="campo mt-1"
            >
              <option value="">{etiquetaTodos}</option>
              {estados.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3 flex min-h-5 items-center gap-3 text-xs">
        {pendiente && <span className="text-muted">Buscando…</span>}
        {activos && !pendiente && (
          <button
            type="button"
            onClick={() => {
              setQ('')
              navegar({ q: '', desde: '', hasta: '', estado: '' })
            }}
            className="font-medium text-acento hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
