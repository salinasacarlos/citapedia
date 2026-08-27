import { exigirSuperadmin } from '@/lib/plataforma/acceso'
import { reactivarConsultorio } from '@/lib/plataforma/actions'
import { SuspenderConsultorio } from '@/components/suspender-consultorio'
import { AltaConsultorio } from '@/components/alta-consultorio'
import { EstadoVacio } from '@/components/estado-vacio'
import { fechaCorta, relativo } from '@/lib/fechas'

export const dynamic = 'force-dynamic'

type Consultorio = {
  id: string
  name: string
  slug: string
  specialty: string | null
  email: string | null
  created_at: string
  suspended_at: string | null
  suspended_reason: string | null
  miembros: number
  pacientes: number
  citas: number
  citas_30d: number
  ultima_cita: string | null
  ultimo_ingreso: string | null
}

type Resumen = {
  consultorios: number
  activos: number
  suspendidos: number
  altas_30d: number
  pacientes: number
  citas: number
  citas_30d: number
  solicitudes_abiertas: number
}

function Dato({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string
  valor: number | string
  nota?: string
}) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
    </div>
  )
}

export default async function Plataforma() {
  const supabase = await exigirSuperadmin()

  const [{ data: resumen }, { data: consultorios }] = await Promise.all([
    supabase.rpc('plataforma_resumen').returns<Resumen[]>(),
    supabase.rpc('plataforma_consultorios').returns<Consultorio[]>(),
  ])

  const r = resumen?.[0]
  const lista = consultorios ?? []

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Consultorios</h1>
          <p className="mt-1 text-sm text-muted">
            Uso de la plataforma. Aquí no se ve nada clínico: ni expedientes, ni notas
            de consulta, ni estudios.
          </p>
        </div>
        <div className="sm:shrink-0">
          <AltaConsultorio />
        </div>
      </header>

      {r && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato
            etiqueta="Consultorios activos"
            valor={r.activos}
            nota={r.suspendidos > 0 ? `${r.suspendidos} suspendidos` : undefined}
          />
          <Dato etiqueta="Altas en 30 días" valor={r.altas_30d} />
          <Dato
            etiqueta="Citas en 30 días"
            valor={r.citas_30d}
            nota={`${r.citas} en total`}
          />
          <Dato
            etiqueta="Pacientes"
            valor={r.pacientes}
            nota={`${r.solicitudes_abiertas} solicitudes esperando respuesta`}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay consultorios" />
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => (
            <li
              key={c.id}
              className={`tarjeta p-4 sm:p-5 ${c.suspended_at ? 'border-peligro/30 bg-peligro-suave/30' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 font-semibold text-ink">
                    {c.name}
                    {c.suspended_at && (
                      <span className="rounded-full bg-peligro-suave px-2 py-0.5 text-xs font-medium text-peligro">
                        Suspendido
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted">
                    <span>/{c.slug}</span>
                    {c.specialty && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{c.specialty}</span>
                      </>
                    )}
                    {c.email && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="break-all">{c.email}</span>
                      </>
                    )}
                  </p>
                  {c.suspended_reason && (
                    <p className="mt-1 text-xs text-peligro">
                      Motivo: {c.suspended_reason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {c.suspended_at ? (
                    <form action={reactivarConsultorio}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="boton boton-primario px-3 py-1.5 text-xs">
                        Reactivar
                      </button>
                    </form>
                  ) : (
                    <SuspenderConsultorio id={c.id} nombre={c.name} />
                  )}
                </div>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <div className="flex gap-1">
                  <dt>Alta:</dt>
                  <dd className="tabular-nums">{fechaCorta(c.created_at, 'UTC')}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Equipo:</dt>
                  <dd className="tabular-nums">{c.miembros}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Pacientes:</dt>
                  <dd className="tabular-nums">{c.pacientes}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Citas:</dt>
                  <dd className="tabular-nums">
                    {c.citas} <span className="opacity-70">({c.citas_30d} en 30 d)</span>
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt>Último ingreso:</dt>
                  {/* Sin ingresos es una cuenta que se creó y nadie volvió a abrir:
                      es justo lo que hay que ver para saber a quién ayudar. */}
                  <dd>{c.ultimo_ingreso ? relativo(c.ultimo_ingreso) : 'nunca'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
