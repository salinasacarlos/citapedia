import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { EstadoVacio } from '@/components/estado-vacio'
import { Filtros } from '@/components/filtros'
import { Paginacion } from '@/components/paginacion'
import { POR_PAGINA, hayFiltros, inicioDelDia, finDelDia, leerFiltros } from '@/lib/filtros'
import { edad, fechaCorta } from '@/lib/fechas'
import type { PatientResumen } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pacientes' }

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filtros = leerFiltros(params)
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()
  const zona = profesional.timezone
  const desde = (filtros.pagina - 1) * POR_PAGINA

  let consulta = supabase.from('patients_resumen').select('*', { count: 'exact' })

  if (filtros.q) {
    const t = filtros.q.replace(/[,()*]/g, '')
    consulta = consulta.or(`name.ilike.*${t}*,phone.ilike.*${t}*,email.ilike.*${t}*`)
  }
  // Las fechas filtran por última visita: "a quién no he visto desde…".
  if (filtros.desde) consulta = consulta.gte('ultima_visita', inicioDelDia(filtros.desde, zona))
  if (filtros.hasta) consulta = consulta.lt('ultima_visita', finDelDia(filtros.hasta, zona))

  const { data, count } = await consulta
    .order('name')
    .range(desde, desde + POR_PAGINA - 1)
    .returns<PatientResumen[]>()

  const pacientes = data ?? []
  const total = count ?? 0

  const paramsExport = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    const valor = Array.isArray(v) ? v[0] : v
    if (valor && k !== 'pagina') paramsExport.set(k, valor)
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Pacientes</h1>
          <p className="mt-1 text-sm text-muted">
            Quienes han agendado contigo, con su historial.
          </p>
        </div>
        {total > 0 && (
          <a
            href={`/admin/pacientes/exportar?${paramsExport}`}
            className="boton boton-suave"
            download
          >
            Descargar Excel
          </a>
        )}
      </header>

      <Filtros
        ruta="/admin/pacientes"
        placeholder="Buscar por nombre, teléfono o correo"
      />

      <p className="mb-3 text-sm text-muted">
        {total === 0
          ? 'Ningún paciente.'
          : `${total} ${total === 1 ? 'paciente' : 'pacientes'}${
              hayFiltros(filtros) ? ' con estos filtros' : ''
            }.`}
      </p>

      {pacientes.length === 0 ? (
        <EstadoVacio titulo={hayFiltros(filtros) ? 'Nadie coincide' : 'Todavía no tienes pacientes'}>
          {hayFiltros(filtros)
            ? 'Prueba con otro nombre o amplía el rango de fechas.'
            : 'En cuanto alguien agende desde tu página pública, aparecerá aquí con su expediente.'}
        </EstadoVacio>
      ) : (
        <ul className="space-y-2">
          {pacientes.map((p) => {
            const años = edad(p.birth_date)
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/pacientes/${p.id}`}
                  className="tarjeta flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 transition hover:border-brand"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {p.name}
                      {años && <span className="ml-2 text-sm font-normal text-muted">{años}</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-muted">
                      {p.phone && <span className="whitespace-nowrap">{p.phone}</span>}
                      {p.tutor_name && (
                        <>
                          {p.phone && <span aria-hidden>·</span>}
                          <span>
                            {p.tutor_relationship ?? 'Tutor'}: {p.tutor_name}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-right text-xs text-muted">
                    <p>
                      {p.citas_atendidas} {p.citas_atendidas === 1 ? 'consulta' : 'consultas'}
                    </p>
                    {p.proxima_cita ? (
                      <p className="text-brand">
                        Próxima: {fechaCorta(p.proxima_cita, zona)}
                      </p>
                    ) : p.ultima_visita ? (
                      <p>Última: {fechaCorta(p.ultima_visita, zona)}</p>
                    ) : (
                      <p>Sin consultas aún</p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Paginacion
        ruta="/admin/pacientes"
        params={params}
        pagina={filtros.pagina}
        total={total}
        porPagina={POR_PAGINA}
      />
    </>
  )
}
