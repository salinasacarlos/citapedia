import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCorreo } from '@/lib/correo/enviar'
import { armarRecordatorio, correoParaAvisar } from '@/lib/correo/recordatorio'
import { anotarFalloDeCorreo } from '@/lib/correo/anotar-fallo'
import { armarAviso } from '@/lib/correo/aviso'
import type { AppointmentStatus } from '@/lib/database.types'

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
  const ahora = new Date()
  const limite = new Date(ahora.getTime() + VENTANA_HORAS * 3600_000)

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `id, access_token, starts_at, status, professional_id,
       patients(name, email, is_minor, tutor_name, tutor_email),
       professionals(name, slug, timezone, clinic_address, phone)`,
    )
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('starts_at', ahora.toISOString())
    .lte('starts_at', limite.toISOString())
    .order('starts_at')
    .returns<Fila[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const citas = data ?? []
  // Los avisos van aunque no haya una sola cita que recordar: cuelgan del
  // paciente, no de la agenda. Salir antes de mandarlos hacía que en un día sin
  // citas no saliera ninguno, y en silencio.
  if (citas.length === 0) {
    return NextResponse.json({
      revisadas: 0,
      enviados: 0,
      sin_correo: 0,
      fallidos: 0,
      avisos: await mandarAvisos(supabase),
    })
  }

  // Cada consultorio decide con cuánta anticipación avisa.
  const { data: ajustes } = await supabase
    .from('reminder_settings')
    .select('professional_id, hours_before, message_template')
    .in('professional_id', [...new Set(citas.map((c) => c.professional_id))])
    .returns<
      { professional_id: string; hours_before: number[] | null; message_template: string | null }[]
    >()

  const porMedico = new Map((ajustes ?? []).map((a) => [a.professional_id, a]))
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://citapedia.vercel.app'

  let enviados = 0
  let sinCorreo = 0
  let fallidos = 0
  const errores: string[] = []

  for (const cita of citas) {
    const ajuste = porMedico.get(cita.professional_id)
    // Sin configuración explícita, un día antes: es lo que trae la tabla por
    // defecto y lo que espera quien nunca abrió esa pantalla.
    const horas = Math.max(...(ajuste?.hours_before?.length ? ajuste.hours_before : [24]))
    const faltan = (new Date(cita.starts_at).getTime() - ahora.getTime()) / 3600_000

    // Todavía no toca: se recogerá en una corrida siguiente.
    if (faltan > horas) continue
    if (!cita.patients || !cita.professionals) continue

    const destinatario = correoParaAvisar(cita.patients)
    if (!destinatario) {
      // Sin correo no hay nada que mandar, pero tampoco hay que reintentarlo
      // mañana: se marca para que no se quede atorada en cada corrida.
      sinCorreo++
      await supabase
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
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
      plantilla:
        ajuste?.message_template ??
        'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.',
      liga: `${sitio}/cita/${cita.access_token}`,
    })

    const envio = await enviarCorreo(correo)

    if (!envio.ok) {
      // No se marca: si Resend falló, mañana se vuelve a intentar. Un
      // recordatorio repetido molesta; uno que nunca sale, cuesta la cita.
      fallidos++
      if (errores.length < 5) errores.push(envio.error)
      // Este cron corre de madrugada y nadie lee su respuesta: sin dejar
      // constancia, que los recordatorios dejen de salir es invisible hasta
      // que un paciente no llega.
      await anotarFalloDeCorreo('recordatorio', envio.error)
      continue
    }

    await supabase
      .from('appointments')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', cita.id)
    enviados++
  }

  const avisos = await mandarAvisos(supabase)

  return NextResponse.json({
    revisadas: citas.length,
    enviados,
    sin_correo: sinCorreo,
    fallidos,
    avisos,
    ...(errores.length ? { errores } : {}),
  })
}

type FilaAviso = {
  id: string
  titulo: string
  mensaje: string | null
  patients: {
    name: string
    email: string | null
    is_minor: boolean | null
    tutor_name: string | null
    tutor_email: string | null
  } | null
  professionals: { name: string; slug: string } | null
}

/**
 * Los avisos programados que vencen hoy o antes.
 *
 * Van en la misma corrida que los recordatorios: es el mismo trabajo —mirar
 * qué toca hoy y mandarlo— y un segundo cron sería otra cosa que puede fallar
 * en silencio.
 */
async function mandarAvisos(supabase: ReturnType<typeof createAdminClient>) {
  const hoy = new Date().toISOString().slice(0, 10)
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const { data } = await supabase
    .from('patient_alerts')
    .select(
      `id, titulo, mensaje,
       patients(name, email, is_minor, tutor_name, tutor_email),
       professionals(name, slug)`,
    )
    .eq('status', 'pendiente')
    .lte('due_on', hoy)
    .limit(200)
    .returns<FilaAviso[]>()

  let enviados = 0
  let fallidos = 0

  for (const aviso of data ?? []) {
    if (!aviso.patients || !aviso.professionals) continue

    const destinatario = correoParaAvisar(aviso.patients)
    // Sin correo no se marca: sigue en la lista para que alguien lo mande por
    // WhatsApp. Al revés que los recordatorios, aquí no hay una cita que se
    // pierda si esperamos.
    if (!destinatario) continue

    const envio = await enviarCorreo(
      armarAviso({
        destinatario,
        paciente: aviso.patients.name,
        esMenor: Boolean(aviso.patients.is_minor),
        doctor: aviso.professionals.name,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        pagina: `${sitio}/${aviso.professionals.slug}`,
      }),
    )

    if (!envio.ok) {
      fallidos++
      await anotarFalloDeCorreo('aviso', envio.error)
      continue
    }

    await supabase
      .from('patient_alerts')
      .update({ status: 'enviado', sent_at: new Date().toISOString() })
      .eq('id', aviso.id)
    enviados++
  }

  return { enviados, fallidos }
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
      'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.',
    liga: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://citapedia.vercel.app'}/cita/prueba`,
  })

  const envio = await enviarCorreo(correo)
  return NextResponse.json(
    envio.ok
      ? { prueba: true, enviado_a: destino, id: envio.id }
      : { prueba: true, enviado_a: destino, error: envio.error },
    { status: envio.ok ? 200 : 502 },
  )
}
