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

/** Escala DENTRO de la plataforma, sin relación con la del consultorio. */
export type PlatformRole = 'fundador' | 'soporte'

export type MemberRole = 'owner' | 'assistant'

export type Professional = {
  /** Cuenta desactivada por la plataforma. Null = activa. */
  suspended_at: string | null
  suspended_reason: string | null
  /** Consultorio cerrado. Los datos se conservan cinco años. */
  archived_at?: string | null
  archived_reason?: string | null
  /** Cuándo pidió no ver más los primeros pasos. */
  onboarding_hidden_at?: string | null
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
  tutor_email: string | null
  tutor_relationship: string | null
  /** La cita la agendó alguien más para este paciente. */
  is_minor: boolean | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  insurance: string | null
  /** Cómo llegó. Null = no se preguntó, distinto de 'otro'. */
  source: string | null
  referred_by: string | null
  notes: string | null
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
  family_history: string | null
  surgical_history: string | null
  immunizations: string | null
  habits: string | null
  updated_at: string | null
}

/**
 * Lo que el paciente declaró al agendar. Deliberadamente separado del
 * expediente: no está verificado por nadie.
 */
export type DeclaredRecord = {
  patient_id: string
  professional_id: string
  allergies: string | null
  conditions: string | null
  medications: string | null
  blood_type: string | null
  consent_at: string
  declared_at: string
  reviewed_at: string | null
  reviewed_by: string | null
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
  temperature_c: number | null
  blood_pressure: string | null
  heart_rate: number | null
  oxygen_saturation: number | null
  diagnosis: string | null
  treatment: string | null
  /** Cuándo debería volver. Es la indicación de ESTA consulta. */
  follow_up_at: string | null
  follow_up_reason: string | null
  created_at: string | null
  updated_at: string | null
}

/** Un estudio o documento del expediente. Solo dueño, como lo demás clínico. */
export type ConsultationFile = {
  id: string
  professional_id: string
  patient_id: string
  appointment_id: string | null
  path: string
  filename: string
  mime: string
  size_bytes: number
  kind: string | null
  archived_at: string | null
  uploaded_by: string | null
  created_at: string | null
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
  /** Cuándo se le escribió al paciente para confirmar. */
  confirmation_sent_at: string | null
  /** Cuándo salió el recordatorio automático por correo. */
  reminder_sent_at: string | null
  /** Credencial de la liga que el paciente recibe por WhatsApp. */
  access_token: string
  /** Cuándo el paciente dijo que sí viene. */
  patient_confirmed_at: string | null
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
      declared_records: Table<DeclaredRecord>
      consultation_notes: Table<ConsultationNote>
      consultation_files: Table<ConsultationFile>
      patient_alerts: Table<{
        id: string
        professional_id: string
        patient_id: string
        due_on: string
        titulo: string
        mensaje: string | null
        status: 'pendiente' | 'enviado' | 'cancelado'
        sent_at: string | null
        created_by: string | null
        created_at: string | null
      }>
      email_failures: Table<{
        id: string
        kind: string
        reason: string
        created_at: string | null
      }>
      /** Ligas para poner la contraseña por primera vez. Solo la llave de servicio. */
      access_grants: Table<{
        id: string
        user_id: string
        email: string
        token: string
        created_by: string | null
        created_at: string
        expires_at: string
        used_at: string | null
      }>
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
      es_superadmin: { Args: Record<string, never>; Returns: boolean }
      puede_recuperar: { Args: { p_email: string }; Returns: boolean }
      archivar_consultorio: {
        Args: { p_id: string; p_motivo?: string | null }
        Returns: undefined
      }
      avisos_pendientes: {
        Args: { p_dias_de_gracia?: number }
        Returns: {
          id: string
          patient_id: string
          paciente: string
          telefono: string | null
          es_menor: boolean
          tutor: string | null
          due_on: string
          titulo: string
          mensaje: string | null
        }[]
      }
      controles_pendientes: {
        Args: { p_dias_de_gracia?: number }
        Returns: {
          patient_id: string
          paciente: string
          telefono: string | null
          es_menor: boolean
          tutor: string | null
          toca_el: string
          motivo: string | null
          ultima_visita: string | null
        }[]
      }
      historial_de_nota: {
        Args: { p_cita: string }
        Returns: {
          replaced_at: string
          motivo: string
          autor: string | null
          note: string | null
          diagnosis: string | null
          treatment: string | null
        }[]
      }
      origenes_consultorio: {
        Args: Record<string, never>
        Returns: { source: string; cuantos: number }[]
      }
      recomendantes_consultorio: {
        Args: { p_limite?: number }
        Returns: { quien: string; cuantos: number }[]
      }
      cobertura_origen: {
        Args: Record<string, never>
        Returns: { con_origen: number; total: number }[]
      }
      metricas_consultorio: {
        Args: { p_desde?: string | null; p_hasta?: string | null }
        Returns: {
          pacientes: number
          pacientes_periodo: number
          por_revisar: number
          por_cerrar: number
          proximas_7d: number
          sin_confirmar_7d: number
          atendidas: number
          inasistencias: number
          canceladas: number
          agendadas: number
          cerradas_con_confirmacion: number
          faltaron_con_confirmacion: number
          cerradas_sin_confirmacion: number
          faltaron_sin_confirmacion: number
          minutos_semana: number
          minutos_agendados_7d: number
        }[]
      }
      plataforma_correos_fallidos: {
        Args: { p_dias?: number }
        Returns: { kind: string; reason: string; cuantos: number; ultimo: string }[]
      }
      es_operador: { Args: Record<string, never>; Returns: boolean }
      plataforma_usuario_del_equipo: {
        Args: { p_id: string; p_email: string }
        Returns: string | null
      }
      plataforma_operadores: {
        Args: Record<string, never>
        Returns: { email: string; rol: PlatformRole; note: string | null; desde: string }[]
      }
      plataforma_dar_permiso: {
        Args: { p_email: string; p_rol: PlatformRole }
        Returns: undefined
      }
      plataforma_quitar_permiso: { Args: { p_email: string }; Returns: undefined }
      plataforma_resumen: {
        Args: Record<string, never>
        Returns: {
          consultorios: number
          activos: number
          suspendidos: number
          altas_30d: number
          pacientes: number
          citas: number
          citas_30d: number
          solicitudes_abiertas: number
        }[]
      }
      plataforma_consultorios: {
        Args: Record<string, never>
        Returns: {
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
        }[]
      }
      plataforma_consultorio: {
        Args: { p_id: string }
        Returns: {
          id: string
          name: string
          slug: string
          specialty: string | null
          email: string | null
          timezone: string
          slot_duration: number
          created_at: string
          suspended_at: string | null
          suspended_reason: string | null
          franjas: number
          bloqueos: number
          pacientes: number
          solicitadas: number
          confirmadas: number
          atendidas: number
          inasistencias: number
          canceladas: number
          recordatorios_horas: number[] | null
          ultima_actividad: string | null
        }[]
      }
      plataforma_equipo: {
        Args: { p_id: string }
        Returns: {
          email: string
          rol: MemberRole
          desde: string
          ultimo_ingreso: string | null
        }[]
      }
      plataforma_citas: {
        Args: { p_id: string; p_limite?: number }
        Returns: {
          starts_at: string
          ends_at: string
          status: AppointmentStatus
          created_at: string
          tiene_paciente: boolean
          confirmada_por_paciente: boolean
          recordatorio_enviado: boolean
        }[]
      }
      plataforma_bitacora: {
        Args: { p_target?: string | null; p_limite?: number }
        Returns: {
          created_at: string
          action: string
          detail: string | null
          target: string | null
          actor: string | null
        }[]
      }
      plataforma_anotar: {
        Args: { p_action: string; p_target: string | null; p_detail?: string | null }
        Returns: undefined
      }
      plataforma_suspender: { Args: { p_id: string; p_motivo: string }; Returns: undefined }
      plataforma_reactivar: { Args: { p_id: string }; Returns: undefined }
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
      ver_cita: {
        Args: { p_token: string }
        Returns: {
          cita_id: string
          consultorio: string
          slug: string
          direccion: string | null
          telefono: string | null
          zona: string
          paciente: string | null
          es_menor: boolean
          tutor: string | null
          inicio: string
          fin: string
          estado: AppointmentStatus
          confirmada_por_paciente: boolean
          ya_declaro: boolean
          puede_reagendar: boolean
          duracion_min: number
        }[]
      }
      reagendar_cita_paciente: {
        Args: { p_token: string; p_inicio: string }
        Returns: string
      }
      confirmar_asistencia: { Args: { p_token: string }; Returns: undefined }
      cancelar_cita_paciente: { Args: { p_token: string }; Returns: undefined }
      declarar_datos_medicos: {
        Args: {
          p_token: string
          p_consentimiento: boolean
          p_alergias?: string | null
          p_padecimientos?: string | null
          p_medicamentos?: string | null
          p_tipo_sangre?: string | null
        }
        Returns: undefined
      }
      aceptar_datos_declarados: {
        Args: { p_paciente: string }
        Returns: undefined
      }
      agendar_cita: {
        Args: {
          p_paciente: string
          p_inicio: string
          p_duracion?: number | null
          p_notas?: string | null
        }
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
          p_tutor?: string | null
          p_parentesco?: string | null
          p_origen?: string | null
          p_referido?: string | null
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
