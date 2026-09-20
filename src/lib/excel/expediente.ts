import writeXlsxFile from 'write-excel-file/node'
import { edad } from '@/lib/fechas'
import type {
  AppointmentStatus,
  ClinicalRecord,
  ConsultationNote,
  Patient,
} from '@/lib/database.types'

/**
 * Exportación a Excel de verdad (.xlsx), no CSV.
 *
 * CSV parece suficiente hasta que Excel se come el "+" de un teléfono, lo
 * convierte a notación científica y rompe los acentos. Con nombres y
 * teléfonos mexicanos eso pasa siempre, así que los teléfonos van forzados a
 * texto y las fechas como fechas de verdad.
 */

export const ESTADO_ES: Record<AppointmentStatus, string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  completed: 'Se atendió',
  cancelled_by_patient: 'Canceló el paciente',
  cancelled_by_professional: 'Canceló el consultorio',
  rejected: 'Rechazada',
  rescheduled: 'Reagendada',
  no_show: 'No asistió',
  expired: 'Venció',
}

export type CitaExport = {
  id: string
  patient_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
}

export type RecetaExport = {
  patient_id: string
  medicamento: string
  dosis: string | null
  frecuencia: string | null
  duracion: string | null
  indicaciones: string | null
  created_at: string
  archived_at: string | null
}

type Datos = {
  consultorio: string
  zona: string
  pacientes: Patient[]
  citas: CitaExport[]
  /** Solo llegan si quien exporta es el dueño. */
  expedientes: ClinicalRecord[]
  consultas: ConsultationNote[]
  recetas: RecetaExport[]
  incluyeClinico: boolean
  /** Qué hojas llevarse. Sin esto, todas. */
  hojas?: string[]
}

const ENCABEZADO = { fontWeight: 'bold' as const, backgroundColor: '#E6F7F5' }

function texto(valor: string | null | undefined) {
  return { type: String, value: valor ?? '' }
}

function numero(valor: number | null | undefined) {
  return valor === null || valor === undefined
    ? { type: String, value: '' }
    : { type: Number, value: Number(valor) }
}

/** Un teléfono es texto: si va como número, Excel se come el + y los ceros. */
const comoTexto = texto

function fechaLocal(iso: string | null, zona: string) {
  if (!iso) return { type: String, value: '' }
  return {
    type: String,
    value: new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeZone: zona,
    }).format(new Date(iso)),
  }
}

function horaLocal(iso: string | null, zona: string) {
  if (!iso) return { type: String, value: '' }
  return {
    type: String,
    value: new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: zona,
    }).format(new Date(iso)),
  }
}

function encabezados(titulos: string[]) {
  return titulos.map((t) => ({ value: t, ...ENCABEZADO, type: String }))
}

export async function construirExpediente(datos: Datos) {
  const { pacientes, citas, expedientes, consultas, recetas, zona, incluyeClinico } = datos
  const porPaciente = new Map(pacientes.map((p) => [p.id, p]))
  const nombre = (id: string) => porPaciente.get(id)?.name ?? 'Paciente'
  const columnas = (anchos: number[]) => anchos.map((width) => ({ width }))

  const hojaPacientes = {
    sheet: 'Pacientes',
    columns: columnas([26, 10, 18, 12, 14, 18, 28, 24, 14, 18, 26, 22, 16, 18, 18, 30]),
    data: [
      encabezados([
        'Nombre', 'Edad', 'Fecha de nacimiento', 'Sexo', 'Depende de alguien',
        'Teléfono', 'Correo', 'Responsable', 'Parentesco', 'Teléfono del responsable',
        'Contacto de emergencia', 'Parentesco', 'Teléfono de emergencia',
        'Seguro', 'Notas de recepción',
      ]),
      ...pacientes.map((p) => [
        texto(p.name),
        texto(edad(p.birth_date)),
        texto(p.birth_date),
        texto(p.sex),
        texto(p.is_minor ? 'Sí' : 'No'),
        comoTexto(p.phone),
        texto(p.email),
        texto(p.tutor_name),
        texto(p.tutor_relationship),
        comoTexto(p.tutor_phone),
        texto(p.tutor_email),
        texto(p.emergency_contact_name),
        texto(p.emergency_contact_relationship),
        comoTexto(p.emergency_contact_phone),
        texto(p.insurance),
        texto(p.notes),
      ]),
    ],
  }

  const hojaCitas = {
    sheet: 'Citas',
    columns: columnas([26, 12, 12, 22, 50]),
    data: [
      encabezados(['Paciente', 'Fecha', 'Hora', 'Estado', 'Motivo que escribió el paciente']),
      ...citas.map((c) => [
        texto(nombre(c.patient_id)),
        fechaLocal(c.starts_at, zona),
        horaLocal(c.starts_at, zona),
        texto(ESTADO_ES[c.status]),
        texto(c.notes),
      ]),
    ],
  }

  // Las hojas clínicas solo se arman si quien exporta es el dueño. No basta
  // con esconderlas: si el asistente pudiera pedirlas, las tendría.
  const hojasClinicas = incluyeClinico
    ? [
        {
          sheet: 'Expediente',
          columns: columnas([26, 30, 30, 30, 14, 30, 30, 30, 30, 40]),
          data: [
            encabezados([
              'Paciente', 'Alergias', 'Padecimientos', 'Medicamentos',
              'Tipo de sangre', 'Vacunas', 'Cirugías y hospitalizaciones',
              'Antecedentes familiares', 'Hábitos', 'Notas',
            ]),
            ...expedientes.map((e) => [
              texto(nombre(e.patient_id)),
              texto(e.allergies),
              texto(e.conditions),
              texto(e.medications),
              texto(e.blood_type),
              texto(e.immunizations),
              texto(e.surgical_history),
              texto(e.family_history),
              texto(e.habits),
              texto(e.notes),
            ]),
          ],
        },
        {
          sheet: 'Recetas',
          columns: columnas([26, 12, 30, 16, 18, 14, 40, 12]),
          data: [
            encabezados([
              'Paciente', 'Fecha', 'Medicamento', 'Dosis', 'Frecuencia',
              'Duración', 'Indicaciones', 'Estado',
            ]),
            ...recetas.map((r) => [
              texto(nombre(r.patient_id)),
              fechaLocal(r.created_at, zona),
              texto(r.medicamento),
              texto(r.dosis),
              texto(r.frecuencia),
              texto(r.duracion),
              texto(r.indicaciones),
              // Las retiradas no se omiten: que un medicamento se haya
              // suspendido es parte de lo que el expediente tiene que contar.
              texto(r.archived_at ? 'Retirado' : 'Vigente'),
            ]),
          ],
        },
        {
          sheet: 'Consultas',
          columns: columnas([26, 12, 10, 10, 10, 12, 10, 10, 30, 40, 50]),
          data: [
            encabezados([
              'Paciente', 'Fecha', 'Peso (kg)', 'Talla (cm)', 'Temp. (°C)',
              'Presión arterial', 'Pulso (lpm)', 'Sat. O₂ (%)',
              'Diagnóstico', 'Tratamiento', 'Nota de consulta',
            ]),
            ...consultas.map((n) => [
              texto(nombre(n.patient_id)),
              fechaLocal(n.created_at, zona),
              numero(n.weight_kg),
              numero(n.height_cm),
              numero(n.temperature_c),
              // La presión va como texto: "100/65" no es un número.
              comoTexto(n.blood_pressure),
              numero(n.heart_rate),
              numero(n.oxygen_saturation),
              texto(n.diagnosis),
              texto(n.treatment),
              texto(n.note),
            ]),
          ],
        },
      ]
    : []

  // Se arman todas y al final se elige: quien pidió solo el expediente no
  // tiene por qué llevarse la agenda de un paciente en el mismo archivo.
  const todas = [hojaPacientes, hojaCitas, ...hojasClinicas]
  const elegidas = datos.hojas
    ? todas.filter((h) => datos.hojas!.includes(h.sheet))
    : todas

  // Un Excel sin hojas no se puede abrir; si el filtro deja todo fuera, se
  // devuelve al menos quién es el paciente.
  return writeXlsxFile(elegidas.length > 0 ? elegidas : [hojaPacientes]).toBuffer()
}

/** 'Dr. Ernesto Peña' → 'dr-ernesto-pena' para el nombre del archivo. */
export function nombreArchivo(base: string, sufijo: string) {
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${limpio || 'citapedia'}-${sufijo}.xlsx`
}
