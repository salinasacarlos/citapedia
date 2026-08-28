import writeXlsxFile from 'write-excel-file/node'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { describirOrigen } from '@/lib/origen'
import type { Metricas } from '@/components/insights'
import type { AppointmentStatus } from '@/lib/database.types'

const ESTADO: Record<AppointmentStatus, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  expired: 'Venció',
  completed: 'Se atendió',
  no_show: 'No asistió',
  cancelled_by_patient: 'Canceló el paciente',
  cancelled_by_professional: 'Canceló el consultorio',
  rescheduled: 'Reagendada',
}

type Fila = {
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  created_at: string | null
  patient_confirmed_at: string | null
  patients: { name: string; source: string | null; referred_by: string | null } | null
}

const encabezado = { fontWeight: 'bold' as const, backgroundColor: '#e6f7f5' }

/**
 * El Excel del periodo que se está viendo.
 *
 * Dos hojas: el resumen —los mismos números de la pantalla, para pegarlos en
 * un reporte— y el detalle de las citas, que es lo que alguien va a querer
 * filtrar y sumar por su cuenta. Sin nada clínico: esto es operación, y el
 * expediente ya tiene su propia exportación.
 */
export async function exportarMetricas(
  desde: string,
  hasta: string,
  etiqueta: string,
  sufijoArchivo: string,
) {
  const { profesional } = await exigirConsultorio()
  const supabase = await createClient()

  const [{ data: metricas }, { data: citas }] = await Promise.all([
    supabase
      .rpc('metricas_consultorio', { p_desde: desde, p_hasta: hasta })
      .returns<Metricas[]>(),
    supabase
      .from('appointments')
      .select(
        'starts_at, ends_at, status, created_at, patient_confirmed_at, patients(name, source, referred_by)',
      )
      .gte('starts_at', desde)
      .lte('starts_at', hasta)
      .order('starts_at')
      .returns<Fila[]>(),
  ])

  const m = metricas?.[0]
  if (!m) return null

  const zona = profesional.timezone
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', {
      timeZone: zona,
      dateStyle: 'short',
      timeStyle: 'short',
    })

  type Celda = { value: string | number; type?: typeof Number } & Partial<
    typeof encabezado
  >
  const resumen: Celda[][] = [
    [{ value: 'Concepto', ...encabezado }, { value: 'Valor', ...encabezado }],
    [{ value: 'Consultorio' }, { value: profesional.name }],
    [{ value: 'Periodo' }, { value: etiqueta }],
    [{ value: 'Generado' }, { value: fecha(new Date().toISOString()) }],
    [{ value: '' }, { value: '' }],
    [{ value: 'Citas agendadas' }, { value: m.agendadas, type: Number }],
    [{ value: 'Consultas atendidas' }, { value: m.atendidas, type: Number }],
    [{ value: 'No asistieron' }, { value: m.inasistencias, type: Number }],
    [{ value: 'Canceladas' }, { value: m.canceladas, type: Number }],
    [{ value: 'Pacientes nuevos' }, { value: m.pacientes_periodo, type: Number }],
    [{ value: 'Pacientes en total' }, { value: m.pacientes, type: Number }],
    [{ value: '' }, { value: '' }],
    [{ value: 'Solicitudes por revisar (hoy)' }, { value: m.por_revisar, type: Number }],
    [{ value: 'Citas por cerrar (hoy)' }, { value: m.por_cerrar, type: Number }],
    [{ value: 'Citas esta semana' }, { value: m.proximas_7d, type: Number }],
    [{ value: '' }, { value: '' }],
    [
      { value: 'Cerradas con confirmación del paciente' },
      { value: m.cerradas_con_confirmacion, type: Number },
    ],
    [
      { value: '  de las cuales no asistieron' },
      { value: m.faltaron_con_confirmacion, type: Number },
    ],
    [
      { value: 'Cerradas sin confirmación' },
      { value: m.cerradas_sin_confirmacion, type: Number },
    ],
    [
      { value: '  de las cuales no asistieron' },
      { value: m.faltaron_sin_confirmacion, type: Number },
    ],
  ]

  const detalle: Celda[][] = [
    [
      { value: 'Fecha y hora', ...encabezado },
      { value: 'Duración (min)', ...encabezado },
      { value: 'Paciente', ...encabezado },
      { value: 'Estado', ...encabezado },
      { value: 'Confirmó', ...encabezado },
      { value: 'Pedida el', ...encabezado },
      { value: 'Cómo llegó', ...encabezado },
    ],
    ...(citas ?? []).map((c) => [
      { value: fecha(c.starts_at) },
      {
        value: Math.round(
          (new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000,
        ),
        type: Number,
      },
      { value: c.patients?.name ?? '' },
      { value: ESTADO[c.status] },
      { value: c.patient_confirmed_at ? 'Sí' : 'No' },
      { value: c.created_at ? fecha(c.created_at) : '' },
      {
        value:
          describirOrigen(c.patients?.source ?? null, c.patients?.referred_by ?? null) ?? '',
      },
    ]),
  ]

  // Misma forma que el otro Excel del proyecto —hojas como objetos con su
  // nombre y sus anchos, y `.toBuffer()`—: mezclar dos maneras de hacer lo
  // mismo se paga después.
  const buffer = await writeXlsxFile([
    { sheet: 'Resumen', columns: [{ width: 40 }, { width: 26 }], data: resumen },
    {
      sheet: 'Citas',
      columns: [
        { width: 18 },
        { width: 14 },
        { width: 26 },
        { width: 22 },
        { width: 10 },
        { width: 18 },
        { width: 30 },
      ],
      data: detalle,
    },
  ]).toBuffer()

  return {
    buffer,
    archivo: `metricas-${profesional.slug}-${sufijoArchivo}.xlsx`,
  }
}
