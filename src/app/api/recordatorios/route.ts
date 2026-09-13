import { conLiga, PLANTILLA_POR_DEFECTO } from '@/lib/whatsapp'
import { baseDelSitio } from '@/lib/sitio'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCorreo } from '@/lib/correo/enviar'
import {
  armarRecordatorio,
  correoParaAvisar,
  type EtapaRecordatorio,
} from '@/lib/correo/recordatorio'
import { anotarFalloDeCorreo } from '@/lib/correo/anotar-fallo'
import { armarAviso, type EtapaAviso } from '@/lib/correo/aviso'
import type { Appointment, AppointmentStatus } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Hasta dónde mira el cron. Se recorta después con las horas de cada médico. */
const VENTANA_HORAS = 48

type Fila = {
  id: string
  access_token: string
  starts_at: string
  status: AppointmentStatus
  professional_id: string
  patients: {
    name: string
    email: string | null
    is_minor: boolean | null
    tutor_name: string | null
    tutor_email: string | null
  } | null
  professionals: {
    name: string
    slug: string
    email: string | null
    timezone: string
    clinic_address: string | null
    phone: string | null
  } | null
}

/**
 * Recordatorios automáticos. Lo dispara el cron de Vercel una vez al día.
 *
 * Va con la llave de servicio porque tiene que ver las citas de todos los
 * consultorios y no hay nadie en sesión. Por eso la puerta está cerrada con
 * CRON_SECRET: sin el secreto no se entra, ni siquiera para ver.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET

  // Falla cerrado: sin secreto configurado, el endpoint no existe para nadie.
  // Al revés —abierto mientras no se configure— cualquiera podría vaciar la
  // agenda del día en correos.
  if (!secreto) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  // Modo de prueba: manda UN correo a donde se le diga y no escribe nada. Es
  // la única forma honesta de comprobar que el envío funciona sin dispararle
  // recordatorios a los pacientes de verdad para averiguarlo.
  const destinoPrueba = new URL(request.url).searchParams.get('destino')
  if (destinoPrueba) return prueba(destinoPrueba)

  // Falta de configuración, no choque: un 500 vacío obliga a ir a los logs
  // para enterarse de algo que se puede decir aquí mismo.
  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SECRET_KEY no configurada.' },
      { status: 503 },
    )
  }

  const supabase = createAdminClient()

  const citas = {
    semana: await mandarEtapaDeCitas(supabase, 'semana'),
    vispera: await mandarEtapaDeCitas(supabase, 'vispera'),
    ultimo: await mandarEtapaDeCitas(supabase, 'ultimo'),
  }

  return NextResponse.json({
    citas,
    avisos: await mandarAvisos(supabase),
  })
}

type Conteo = { revisadas: number; enviados: number; sin_correo: number; fallidos: number }

/** Qué columna marca cada etapa como ya mandada. */
const MARCA = {
  semana: 'reminder_early_sent_at',
  vispera: 'reminder_sent_at',
  ultimo: 'reminder_final_sent_at',
} as const satisfies Record<EtapaRecordatorio, keyof Appointment>

/** La marca como objeto tipado: un `[clave]` calculado no lo acepta el tipo. */
function yaSalio(etapa: EtapaRecordatorio) {
  const cuando = new Date().toISOString()
  return etapa === 'semana'
    ? { reminder_early_sent_at: cuando }
    : etapa === 'vispera'
      ? { reminder_sent_at: cuando }
      : { reminder_final_sent_at: cuando }
}

/**
 * Un toque de recordatorio, para todas las citas a las que les toca.
 *
 * Las tres etapas comparten el envío y se distinguen solo en a quién buscan:
 * por eso la consulta se arma aquí y no hay tres copias del mismo bucle.
 */
async function mandarEtapaDeCitas(
  supabase: ReturnType<typeof createAdminClient>,
  etapa: EtapaRecordatorio,
): Promise<Conteo> {
  const ahora = new Date()
  const enHoras = (h: number) => new Date(ahora.getTime() + h * 3600_000).toISOString()

  let consulta = supabase
    .from('appointments')
    .select(
      `id, access_token, starts_at, status, professional_id, reminder_sent_at,
       patients(name, email, is_minor, tutor_name, tutor_email),
       professionals(name, slug, email, timezone, clinic_address, phone)`,
    )
    .eq('status', 'confirmed')
    .is(MARCA[etapa], null)
    .gte('starts_at', ahora.toISOString())

  if (etapa === 'semana') {
    // Todo lo que caiga dentro de la semana y no haya recibido este toque. Si
    // una cita se agenda con cuatro días, igual lo recibe: vale más avisar
    // tarde que no avisar.
    consulta = consulta.lte('starts_at', enHoras(24 * 7))
  } else if (etapa === 'vispera') {
    consulta = consulta.lte('starts_at', enHoras(VENTANA_HORAS))
  } else {
    // El último jalón es solo para quien no ha dicho si viene, y nunca en la
    // misma corrida que la víspera: se exige que ese ya haya salido ayer, o
    // el paciente recibiría dos correos con minutos de diferencia.
    consulta = consulta
      .lte('starts_at', enHoras(VENTANA_HORAS))
      .is('patient_confirmed_at', null)
      .lt('reminder_sent_at', enHoras(-12))
  }

  const { data } = await consulta.order('starts_at').returns<Fila[]>()
  const citas = data ?? []
  const conteo: Conteo = { revisadas: citas.length, enviados: 0, sin_correo: 0, fallidos: 0 }
  if (citas.length === 0) return conteo

  const { data: ajustes } = await supabase
    .from('reminder_settings')
    .select('professional_id, hours_before, message_template')
    .in('professional_id', [...new Set(citas.map((c) => c.professional_id))])
    .returns<
      { professional_id: string; hours_before: number[] | null; message_template: string | null }[]
    >()

  const porMedico = new Map((ajustes ?? []).map((a) => [a.professional_id, a]))
  const sitio = baseDelSitio()

  for (const cita of citas) {
    const ajuste = porMedico.get(cita.professional_id)

    // La anticipación que configura el médico manda solo en la víspera: las
    // otras dos etapas tienen su propio momento y no son negociables.
    if (etapa === 'vispera') {
      const horas = Math.max(...(ajuste?.hours_before?.length ? ajuste.hours_before : [24]))
      const faltan = (new Date(cita.starts_at).getTime() - ahora.getTime()) / 3600_000
      if (faltan > horas) continue
    }

    if (!cita.patients || !cita.professionals) continue

    const destinatario = correoParaAvisar(cita.patients)
    if (!destinatario) {
      // Sin correo no hay nada que mandar, pero tampoco hay que reintentarlo
      // mañana: se marca para que no se quede atorada en cada corrida.
      conteo.sin_correo++
      await supabase
        .from('appointments')
        .update(yaSalio(etapa))
        .eq('id', cita.id)
      continue
    }

    const correo = armarRecordatorio({
      destinatario,
      paciente: cita.patients.name,
      esMenor: Boolean(cita.patients.is_minor),
      doctor: cita.professionals.name,
      direccion: cita.professionals.clinic_address,
      telefono: cita.professionals.phone,
      inicio: cita.starts_at,
      zona: cita.professionals.timezone,
      plantilla: conLiga(ajuste?.message_template ?? PLANTILLA_POR_DEFECTO),
      liga: `${sitio}/cita/${cita.access_token}`,
      etapa,
    })

    const envio = await enviarCorreo({ ...correo, responder: cita.professionals.email })

    if (!envio.ok) {
      // No se marca: si Resend falló, mañana se vuelve a intentar. Un
      // recordatorio repetido molesta; uno que nunca sale, cuesta la cita.
      conteo.fallidos++
      // Este cron corre de madrugada y nadie lee su respuesta: sin dejar
      // constancia, que los recordatorios dejen de salir es invisible hasta
      // que un paciente no llega.
      await anotarFalloDeCorreo('recordatorio', envio.error)
      continue
    }

    await supabase
      .from('appointments')
      .update(yaSalio(etapa))
      .eq('id', cita.id)
    conteo.enviados++
  }

  return conteo
}

type FilaAviso = {
  id: string
  patient_id: string
  titulo: string
  mensaje: string | null
  patients: {
    name: string
    email: string | null
    is_minor: boolean | null
    tutor_name: string | null
    tutor_email: string | null
  } | null
  professionals: { name: string; slug: string; email: string | null } | null
}

/**
 * Los avisos programados que vencen hoy o antes.
 *
 * Van en la misma corrida que los recordatorios: es el mismo trabajo —mirar
 * qué toca hoy y mandarlo— y un segundo cron sería otra cosa que puede fallar
 * en silencio.
 */
async function mandarAvisos(supabase: ReturnType<typeof createAdminClient>) {
  return {
    semana: await mandarEtapaDeAvisos(supabase, 'semana'),
    hoy: await mandarEtapaDeAvisos(supabase, 'hoy'),
    seguimiento: await mandarEtapaDeAvisos(supabase, 'seguimiento'),
  }
}

function enDias(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Un toque de aviso programado.
 *
 * - `semana`: cae dentro de los próximos siete días. Sirve para agendar con
 *   calma, que es justo lo que no se puede hacer el mismo día.
 * - `hoy`: vence hoy o ya venció. Es el que existía.
 * - `seguimiento`: una semana después del anterior, y **solo si el paciente
 *   no agendó nada**. Insistirle a quien ya hizo caso es como se pierde la
 *   confianza en un canal: la siguiente vez ya no lo abre.
 */
async function mandarEtapaDeAvisos(
  supabase: ReturnType<typeof createAdminClient>,
  etapa: EtapaAviso,
) {
  const sitio = baseDelSitio()

  let consulta = supabase
    .from('patient_alerts')
    .select(
      `id, titulo, mensaje, patient_id,
       patients(name, email, is_minor, tutor_name, tutor_email),
       professionals(name, slug, email)`,
    )
    .limit(200)

  if (etapa === 'semana') {
    consulta = consulta
      .eq('status', 'pendiente')
      .is('early_sent_at', null)
      .gt('due_on', enDias(0))
      .lte('due_on', enDias(7))
  } else if (etapa === 'hoy') {
    consulta = consulta.eq('status', 'pendiente').lte('due_on', enDias(0))
  } else {
    consulta = consulta
      .eq('status', 'enviado')
      .is('followup_sent_at', null)
      .lte('sent_at', `${enDias(-7)}T23:59:59Z`)
  }

  const { data } = await consulta.returns<FilaAviso[]>()

  let enviados = 0
  let fallidos = 0
  let ya_agendaron = 0

  for (const aviso of data ?? []) {
    if (!aviso.patients || !aviso.professionals) continue

    // El seguimiento existe para quien no se movió. Preguntarlo aquí y no al
    // armar la lista es a propósito: la respuesta cambia entre una corrida y
    // otra, y el aviso se queda disponible por si vuelve a hacer falta.
    if (etapa === 'seguimiento') {
      const { data: yaTiene } = await supabase.rpc('tiene_cita_por_venir', {
        p_paciente: aviso.patient_id,
      })
      if (yaTiene === true) {
        ya_agendaron++
        await supabase
          .from('patient_alerts')
          .update({ followup_sent_at: new Date().toISOString() })
          .eq('id', aviso.id)
        continue
      }
    }

    const destinatario = correoParaAvisar(aviso.patients)
    // Sin correo no se marca: sigue en la lista para que alguien lo mande por
    // WhatsApp. Al revés que los recordatorios, aquí no hay una cita que se
    // pierda si esperamos.
    if (!destinatario) continue

    const envio = await enviarCorreo({
      responder: aviso.professionals.email,
      ...armarAviso({
        destinatario,
        paciente: aviso.patients.name,
        esMenor: Boolean(aviso.patients.is_minor),
        doctor: aviso.professionals.name,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        pagina: `${sitio}/${aviso.professionals.slug}`,
        etapa,
      }),
    })

    if (!envio.ok) {
      fallidos++
      await anotarFalloDeCorreo('aviso', envio.error)
      continue
    }

    // Solo el toque del día vencido cierra el aviso: los otros dos son
    // acompañamiento, y cerrarlos antes lo sacaría de la lista que trabaja la
    // recepcionista cuando todavía no ha pasado nada.
    await supabase
      .from('patient_alerts')
      .update(
        etapa === 'semana'
          ? { early_sent_at: new Date().toISOString() }
          : etapa === 'hoy'
            ? { status: 'enviado', sent_at: new Date().toISOString() }
            : { followup_sent_at: new Date().toISOString() },
      )
      .eq('id', aviso.id)
    enviados++
  }

  return { enviados, fallidos, ...(etapa === 'seguimiento' ? { ya_agendaron } : {}) }
}

/** Un recordatorio de muestra, con datos inventados y sin tocar la base. */
async function prueba(destino: string) {
  const enUnDia = new Date(Date.now() + 24 * 3600_000)

  const correo = armarRecordatorio({
    destinatario: { nombre: 'Prueba', correo: destino },
    paciente: 'Prueba',
    esMenor: false,
    doctor: 'Dr. Ernesto Peña',
    direccion: 'Av. Universidad 900, Consultorio 12, CDMX',
    telefono: '+52 55 8899 1122',
    inicio: enUnDia.toISOString(),
    zona: 'America/Mexico_City',
    plantilla:
      PLANTILLA_POR_DEFECTO,
    liga: `${baseDelSitio()}/cita/prueba`,
  })

  const envio = await enviarCorreo(correo)
  return NextResponse.json(
    envio.ok
      ? { prueba: true, enviado_a: destino, id: envio.id }
      : { prueba: true, enviado_a: destino, error: envio.error },
    { status: envio.ok ? 200 : 502 },
  )
}
