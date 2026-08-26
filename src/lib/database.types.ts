/**
 * Tipos de la base de datos, alineados con supabase/migrations.
 * Cuando tengas el proyecto enlazado puedes regenerarlos con:
 *   supabase gen types typescript --local > src/lib/database.types.ts
 */

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'completed'
  | 'cancelled_by_patient'
  | 'cancelled_by_professional'
  | 'rejected'
  | 'rescheduled'
  | 'no_show'
  | 'expired'

export type MemberRole = 'owner' | 'assistant'

export type Professional = {
  id: string
  name: string
  email: string
  specialty: string | null
  phone: string | null
  clinic_address: string | null
  slug: string
  bio: string | null
  photo_url: string | null
  theme: string | null
  consultation_info: string | null
  slot_duration: number | null
  timezone: string
  created_at: string | null
  updated_at: string | null
}

export type Membership = {
  id: string
  professional_id: string | null
  user_id: string | null
  role: MemberRole
  created_at: string | null
}

export type Invitation = {
  id: string
  professional_id: string | null
  email: string
  role: MemberRole
  token: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string | null
}

/** Horario recurrente. weekday: 0 = domingo … 6 = sábado. */
export type Availability = {
  id: string
  professional_id: string | null
  weekday: number
  start_time: string
  end_time: string
}

export type TimeBlock = {
  id: string
  professional_id: string | null
  starts_at: string
  ends_at: string
  reason: string | null
}

export type Patient = {
  id: string
  professional_id: string
  name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  sex: 'femenino' | 'masculino' | 'otro' | null
  tutor_name: string | null
  tutor_phone: string | null
  tutor_relationship: string | null
  created_at: string | null
}

/** Expediente clínico. Solo lo ve el dueño del consultorio. */
export type ClinicalRecord = {
  patient_id: string
  professional_id: string
  allergies: string | null
  conditions: string | null
  medications: string | null
  blood_type: string | null
  notes: string | null
  updated_at: string | null
}

/** Una nota por consulta, con lo que el médico midió y encontró. */
export type ConsultationNote = {
  id: string
  appointment_id: string
  patient_id: string
  professional_id: string
  author_id: string | null
  note: string | null
  weight_kg: number | null
  height_cm: number | null
  created_at: string | null
  updated_at: string | null
}

export type PatientResumen = Omit<Patient, 'created_at'> & {
  created_at: string | null
  total_citas: number
  citas_atendidas: number
  ultima_visita: string | null
  proxima_cita: string | null
}

export type Appointment = {
  id: string
  professional_id: string | null
  patient_id: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  rescheduled_to: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type ReminderSettings = {
  professional_id: string
  channel: 'email' | 'sms'
  hours_before: number[] | null
  message_template: string | null
}

/**
 * supabase-js espera exactamente esta forma por tabla (incluido
 * `Relationships`); sin ella, los tipos de insert/update colapsan a `never`.
 */
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      professionals: Table<Professional>
      memberships: Table<Membership>
      invitations: Table<Invitation>
      availability: Table<Availability>
      time_blocks: Table<TimeBlock>
      patients: Table<Patient>
      clinical_records: Table<ClinicalRecord>
      consultation_notes: Table<ConsultationNote>
      appointments: Table<Appointment>
      reminder_settings: Table<ReminderSettings>
    }
    Views: {
      /** Cara pública del médico: sin el email de acceso. */
      public_professionals: {
        Row: Omit<Professional, 'email' | 'created_at' | 'updated_at'>
        Relationships: []
      }
      public_availability: { Row: Availability; Relationships: [] }
      /** Bloqueos sin el motivo. */
      public_time_blocks: { Row: Omit<TimeBlock, 'reason'>; Relationships: [] }
      /** Horas ya tomadas, sin decir por quién. */
      patients_resumen: { Row: PatientResumen; Relationships: [] }
      public_busy_slots: {
        Row: Pick<Appointment, 'professional_id' | 'starts_at' | 'ends_at'>
        Relationships: []
      }
    }
    Functions: {
      miembros_del_consultorio: {
        Args: Record<string, never>
        Returns: {
          membership_id: string
          user_id: string
          email: string
          rol: MemberRole
          desde: string
        }[]
      }
      ver_invitacion: {
        Args: { p_token: string }
        Returns: {
          consultorio: string
          email: string
          rol: MemberRole
          estado: string
          vencida: boolean
        }[]
      }
      aceptar_invitacion: {
        Args: { p_token: string }
        Returns: string
      }
      reagendar_cita: {
        Args: { p_cita: string; p_inicio: string }
        Returns: string
      }
      solicitar_cita: {
        Args: {
          p_slug: string
          p_starts_at: string
          p_nombre: string
          p_telefono?: string | null
          p_email?: string | null
          p_notas?: string | null
        }
        Returns: string
      }
    }
    Enums: {
      appointment_status: AppointmentStatus
      member_role: MemberRole
    }
    CompositeTypes: Record<never, never>
  }
}
