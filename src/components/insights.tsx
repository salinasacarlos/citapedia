import Link from 'next/link'

export type Metricas = {
  pacientes: number
  pacientes_30d: number
  por_revisar: number
  por_cerrar: number
  proximas_7d: number
  sin_confirmar_7d: number
  atendidas_30d: number
  inasistencias_30d: number
  canceladas_30d: number
  cerradas_con_confirmacion: number
  faltaron_con_confirmacion: number
  cerradas_sin_confirmacion: number
  faltaron_sin_confirmacion: number
  minutos_semana: number
  minutos_agendados_7d: number
}

/**
 * Cuántas citas hacen falta antes de atreverse a sacar un porcentaje.
 *
 * Con menos, el número se mueve entero por una sola cita y dice más de la
 * casualidad que del consultorio. Callarse es más útil que publicar ruido con
 * aspecto de dato.
 */
const MINIMO_PARA_OPINAR = 10

function Numero({
  valor,
  etiqueta,
  nota,
  href,
  urgente = false,
}: {
  valor: number | string
  etiqueta: string
  nota?: string
  href?: string
  urgente?: boolean
}) {
  const contenido = (
    <>
      <p className="text-xs text-muted">{etiqueta}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          urgente && Number(valor) > 0 ? 'text-alerta' : 'text-ink'
        }`}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
    </>
  )

  return href ? (
    <Link href={href} className="tarjeta block p-4 transition hover:border-brand/40">
      {contenido}
    </Link>
  ) : (
    <div className="tarjeta p-4">{contenido}</div>
  )
}

export function Insights({ m }: { m: Metricas }) {
  const cerradas30 = m.atendidas_30d + m.inasistencias_30d
  const ocupacion =
    m.minutos_semana > 0
      ? Math.round((m.minutos_agendados_7d / m.minutos_semana) * 100)
      : null

  // La pregunta que esto contesta: ¿sirve de algo pedirles que confirmen?
  const hayParaComparar =
    m.cerradas_con_confirmacion >= MINIMO_PARA_OPINAR &&
    m.cerradas_sin_confirmacion >= MINIMO_PARA_OPINAR
  const faltaConf = hayParaComparar
    ? Math.round((m.faltaron_con_confirmacion / m.cerradas_con_confirmacion) * 100)
    : null
  const faltaSinConf = hayParaComparar
    ? Math.round((m.faltaron_sin_confirmacion / m.cerradas_sin_confirmacion) * 100)
    : null

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Ahora mismo</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            etiqueta="Por revisar"
            valor={m.por_revisar}
            nota={m.por_revisar > 0 ? 'Esperan tu respuesta' : 'Nada pendiente'}
            href="/admin/solicitudes"
            urgente
          />
          <Numero
            etiqueta="Por cerrar"
            valor={m.por_cerrar}
            nota={m.por_cerrar > 0 ? 'Ya pasaron, falta decir qué ocurrió' : 'Al día'}
            href="/admin"
            urgente
          />
          <Numero
            etiqueta="Citas esta semana"
            valor={m.proximas_7d}
            nota={
              m.sin_confirmar_7d > 0
                ? `${m.sin_confirmar_7d} sin confirmar todavía`
                : 'Todas confirmadas'
            }
            href="/admin"
          />
          <Numero
            etiqueta="Agenda ocupada"
            valor={ocupacion === null ? '—' : `${ocupacion}%`}
            nota={
              ocupacion === null
                ? 'Publica tu horario para medirlo'
                : 'De lo que publicaste para esta semana'
            }
            href="/admin/horario"
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Últimos 30 días</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero etiqueta="Consultas atendidas" valor={m.atendidas_30d} />
          <Numero
            etiqueta="Pacientes nuevos"
            valor={m.pacientes_30d}
            nota={`${m.pacientes} en total`}
            href="/admin/pacientes"
          />
          <Numero
            etiqueta="No asistieron"
            valor={m.inasistencias_30d}
            nota={cerradas30 > 0 ? `de ${cerradas30} citas cerradas` : undefined}
          />
          <Numero etiqueta="Canceladas" valor={m.canceladas_30d} />
        </div>
      </section>

      {/*
        El único número que sugiere hacer algo distinto. Se muestra solo con
        suficientes citas de los dos lados: comparar 1 contra 3 no compara nada.
      */}
      {hayParaComparar && faltaConf !== null && faltaSinConf !== null && (
        <section className="tarjeta mb-6 p-4 sm:p-5">
          <h2 className="font-semibold text-ink">¿Sirve pedirles que confirmen?</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-marca bg-surface-2 p-3">
              <p className="text-xs text-muted">Confirmaron que venían</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                {faltaConf}% faltó
              </p>
              <p className="text-xs text-muted">de {m.cerradas_con_confirmacion} citas</p>
            </div>
            <div className="rounded-marca bg-surface-2 p-3">
              <p className="text-xs text-muted">Nunca confirmaron</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                {faltaSinConf}% faltó
              </p>
              <p className="text-xs text-muted">de {m.cerradas_sin_confirmacion} citas</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            {faltaSinConf > faltaConf
              ? `Quien confirma falta ${faltaSinConf - faltaConf} puntos menos. Pedir la confirmación por WhatsApp está valiendo la pena.`
              : faltaConf > faltaSinConf
                ? 'Aquí confirmar no está cambiando nada. Vale la pena mirar si el recordatorio llega con suficiente anticipación.'
                : 'Por ahora da igual confirmar o no.'}
          </p>
        </section>
      )}
    </>
  )
}
