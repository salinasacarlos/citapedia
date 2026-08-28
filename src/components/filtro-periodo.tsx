'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { PERIODOS } from '@/lib/periodo'

/** El periodo vive en la URL, como el resto de los filtros del proyecto. */
export function FiltroPeriodo({ exportar }: { exportar: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()

  const desde = params.get('desde') ?? ''
  const hasta = params.get('hasta') ?? ''
  const periodo = params.get('periodo') ?? '30'
  const aMano = Boolean(desde && hasta)

  function navegar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevos.set(k, v)
      else nuevos.delete(k)
    }
    iniciar(() => router.replace(`/admin?${nuevos}`, { scroll: false }))
  }

  return (
    <div className="tarjeta mb-6 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="periodo" className="block text-xs font-medium text-muted">
            Periodo
          </label>
          <select
            id="periodo"
            value={aMano ? '' : periodo}
            onChange={(e) => navegar({ periodo: e.target.value, desde: '', hasta: '' })}
            className="campo mt-1"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
            {aMano && <option value="">Fechas elegidas</option>}
          </select>
        </div>
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
        <div className="flex items-end">
          {/* Se lleva el mismo periodo que está viendo: descargar otra cosa
              de la que está en pantalla sería una sorpresa desagradable. */}
          <a href={`${exportar}?${params}`} download className="boton boton-suave w-full">
            Descargar Excel
          </a>
        </div>
      </div>

      <div className="mt-2 flex min-h-4 items-center gap-3 text-xs">
        {pendiente && <span className="text-muted">Calculando…</span>}
        {aMano && !pendiente && (
          <button
            type="button"
            onClick={() => navegar({ desde: '', hasta: '', periodo: '30' })}
            className="font-medium text-acento hover:underline"
          >
            Volver a los últimos 30 días
          </button>
        )}
      </div>
    </div>
  )
}
