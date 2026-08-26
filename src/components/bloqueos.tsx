'use client'

import { useCallback, useState } from 'react'
import { Formulario } from '@/components/formulario'
import { BotonQuitar } from '@/components/boton-quitar'
import { agregarBloqueo, quitarBloqueo } from '@/lib/admin/actions'

export type BloqueoVista = {
  id: string
  reason: string | null
  cuando: string
}

/** Hoy en la zona del consultorio, como 'YYYY-MM-DD' para el input date. */
function hoyEn(zona: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function Bloqueos({ zona, bloqueos }: { zona: string; bloqueos: BloqueoVista[] }) {
  const hoy = hoyEn(zona)
  // React 19 resetea el formulario después de cada acción. Con campos
  // controlados, un error no te borra lo que ya habías escrito.
  const [todoElDia, setTodoElDia] = useState(false)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState('')
  const [horaInicio, setHoraInicio] = useState('11:00')
  const [horaFin, setHoraFin] = useState('13:00')
  const [motivo, setMotivo] = useState('')

  // Al guardar bien, formulario limpio para el siguiente. Al fallar, nada se
  // pierde: los campos son controlados y conservan lo escrito.
  const limpiar = useCallback(() => {
    setTodoElDia(false)
    setDesde(hoy)
    setHasta('')
    setHoraInicio('11:00')
    setHoraFin('13:00')
    setMotivo('')
  }, [hoy])

  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Bloqueos</h2>
      <p className="mt-1 text-sm text-muted">
        Ratos puntuales en los que no atiendes, aunque caigan dentro de tu horario:
        juntas, vacaciones, un día que sales temprano.
      </p>

      {bloqueos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {bloqueos.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium first-letter:uppercase">{b.cuando}</p>
                {b.reason && <p className="text-xs text-muted">{b.reason}</p>}
              </div>
              <form action={quitarBloqueo}>
                <input type="hidden" name="id" value={b.id} />
                <BotonQuitar etiqueta={`el bloqueo de ${b.cuando}`} />
              </form>
            </li>
          ))}
        </ul>
      )}

      <Formulario
        accion={agregarBloqueo}
        enviar="Bloquear"
        onExito={limpiar}
        className="mt-5 border-t border-border pt-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fecha_inicio" className="block text-xs font-medium text-muted">
              Desde el día
            </label>
            <input
              id="fecha_inicio"
              name="fecha_inicio"
              type="date"
              required
              min={hoy}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="campo mt-1"
            />
          </div>
          <div>
            <label htmlFor="fecha_fin" className="block text-xs font-medium text-muted">
              Hasta el día <span className="font-normal">(si son varios)</span>
            </label>
            <input
              id="fecha_fin"
              name="fecha_fin"
              type="date"
              min={desde || hoy}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="campo mt-1"
            />
          </div>

          {!todoElDia && (
            <>
              <div>
                <label htmlFor="hora_inicio" className="block text-xs font-medium text-muted">
                  Desde las
                </label>
                <input
                  id="hora_inicio"
                  name="hora_inicio"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  required
                  className="campo mt-1 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="hora_fin" className="block text-xs font-medium text-muted">
                  Hasta las
                </label>
                <input
                  id="hora_fin"
                  name="hora_fin"
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  required
                  className="campo mt-1 tabular-nums"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="todo_el_dia"
                checked={todoElDia}
                onChange={(e) => setTodoElDia(e.target.checked)}
                className="size-4 accent-[var(--brand-vivo)]"
              />
              Todo el día
            </label>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="reason" className="block text-xs font-medium text-muted">
              Motivo <span className="font-normal">(solo tú lo ves)</span>
            </label>
            <input
              id="reason"
              name="reason"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Junta del hospital, vacaciones…"
              className="campo mt-1"
            />
          </div>
        </div>
      </Formulario>
    </section>
  )
}
