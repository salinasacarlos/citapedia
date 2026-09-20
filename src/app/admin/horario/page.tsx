import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { quitarFranja } from '@/lib/admin/actions'
import { AgregarFranja } from '@/components/agregar-franja'
import { BotonQuitar } from '@/components/boton-quitar'
import { Bloqueos, type BloqueoVista } from '@/components/bloqueos'
import { PlantillaRecordatorio } from '@/components/plantilla-recordatorio'
import { PlantillasDeAviso, type PlantillaAviso } from '@/components/plantillas-de-aviso'
import { PapelDeReceta, type PapelDeRecetaGuardado } from '@/components/papel-de-receta'
import { DIAS, SEMANA, describirBloqueo, horaSuelta } from '@/lib/fechas'
import type { Availability, TimeBlock } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Horario' }

export default async function HorarioPage() {
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone

  const [
    { data: franjasCrudas },
    { data: bloqueosCrudos },
    { data: ajustes },
    { data: plantillas },
    { data: papel },
  ] = await Promise.all([
      supabase
        .from('availability')
        .select('id, weekday, start_time, end_time')
        .order('weekday')
        .order('start_time')
        .returns<Pick<Availability, 'id' | 'weekday' | 'start_time' | 'end_time'>[]>(),
      supabase
        .from('time_blocks')
        .select('id, starts_at, ends_at, reason')
        .gte('ends_at', new Date().toISOString())
        .order('starts_at')
      .returns<Pick<TimeBlock, 'id' | 'starts_at' | 'ends_at' | 'reason'>[]>(),
      supabase
        .from('reminder_settings')
        .select('message_template')
        .maybeSingle<{ message_template: string | null }>(),
      supabase
        .from('alert_templates')
        .select('id, titulo, mensaje, base, offset_meses')
        .order('created_at')
        .returns<PlantillaAviso[]>(),
      supabase
        .from('prescription_paper')
        .select('mime, margen_arriba, margen_abajo, updated_at')
        .maybeSingle<PapelDeRecetaGuardado>(),
    ])

  const franjas = franjasCrudas ?? []
  const bloqueos: BloqueoVista[] = (bloqueosCrudos ?? []).map((b) => ({
    id: b.id,
    reason: b.reason,
    cuando: describirBloqueo(b.starts_at, b.ends_at, zona),
  }))

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Tu consultorio</h1>
        <p className="mt-1 text-sm text-muted">
          Tu horario, los mensajes que salen a tus pacientes y el papel con el
          que imprimes tus recetas.
        </p>
      </header>

      <section>
        <h2 className="mb-1 font-semibold text-ink">Tu horario</h2>
        <p className="mb-3 text-sm text-muted">
          Se repite cada semana. De aquí salen los huecos que ofrece tu página,
          menos las citas confirmadas y los bloqueos. Horas de{' '}
          {zona.split('/').pop()!.replace('_', ' ')}.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {SEMANA.map((dia) => {
          const delDia = franjas.filter((f) => f.weekday === dia)
          return (
            <section key={dia} className="tarjeta flex flex-col p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-ink">{DIAS[dia]}</h2>
                {delDia.length === 0 && (
                  <span className="text-xs text-muted">Sin atender</span>
                )}
              </div>

              {delDia.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {delDia.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-2 rounded-lg bg-brand-suave px-2.5 py-1.5 text-sm font-medium text-brand"
                    >
                      <span className="tabular-nums whitespace-nowrap">
                        {horaSuelta(f.start_time)} – {horaSuelta(f.end_time)}
                      </span>
                      <form action={quitarFranja} className="flex">
                        <input type="hidden" name="id" value={f.id} />
                        <BotonQuitar
                          etiqueta={`${horaSuelta(f.start_time)} a ${horaSuelta(f.end_time)} de ${DIAS[dia]}`}
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto">
                <AgregarFranja weekday={dia} dia={DIAS[dia]} />
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-8">
        <Bloqueos zona={zona} bloqueos={bloqueos} />
      </div>

      <div className="mt-8">
        <PlantillasDeAviso plantillas={plantillas ?? []} />
      </div>

      {esDueño && (
        <div className="mt-8">
          <PapelDeReceta papel={papel ?? null} />
        </div>
      )}

      <div className="mt-8">
        <PlantillaRecordatorio
          plantillaGuardada={ajustes?.message_template ?? null}
          doctor={profesional.name}
        />
      </div>
    </>
  )
}
