'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCorreo } from '@/lib/correo/enviar'
import { armarSolicitudRecibida } from '@/lib/correo/solicitud-recibida'
import { anotarFalloDeCorreo } from '@/lib/correo/anotar-fallo'
import { problemaDelSitio } from '@/lib/sitio'

export type EstadoReserva = {
  error?: string
  /** El token es la liga a la cita: sirve para volver y para declarar datos. */
  confirmada?: { cuando: string; medico: string; token: string }
  valores?: Record<string, string>
}

export async function solicitarCita(
  _estado: EstadoReserva,
  datos: FormData,
): Promise<EstadoReserva> {
  const slug = String(datos.get('slug') ?? '')
  const inicio = String(datos.get('inicio') ?? '')
  const nombre = String(datos.get('nombre') ?? '').trim()
  const telefono = String(datos.get('telefono') ?? '').trim()
  const email = String(datos.get('email') ?? '').trim()
  const notas = String(datos.get('notas') ?? '').trim()
  // Quien agenda dice si es para sí mismo o para alguien más. Antes se
  // adivinaba, y adivinar de quién es el teléfono es justo el error caro.
  const paraOtro = datos.get('para_otro') === '1'
  const tutor = String(datos.get('tutor') ?? '').trim()
  const parentesco = String(datos.get('parentesco') ?? '').trim()
  const origen = String(datos.get('source') ?? '').trim()
  const referido = String(datos.get('referred_by') ?? '').trim()
  const medico = String(datos.get('medico') ?? '')
  const cuando = String(datos.get('cuando') ?? '')

  const valores = {
    nombre,
    telefono,
    email,
    notas,
    tutor,
    parentesco,
    source: origen,
    referred_by: referido,
  }

  if (!inicio) return { error: 'Elige un horario primero.', valores }
  if (!nombre) return { error: 'Necesitamos el nombre del paciente.', valores }
  if (paraOtro && !tutor) {
    return { error: 'Escribe tu nombre, para saber quién agenda.', valores }
  }
  if (!telefono && !email) {
    return { error: 'Déjanos un teléfono o un correo para poder confirmarte.', valores }
  }

  const supabase = await createClient()

  // La validación de verdad vive en la base: que el hueco exista, esté libre y
  // siga en el futuro. Aquí solo se traduce lo que responda.
  const { data: token, error } = await supabase.rpc('solicitar_cita', {
    p_slug: slug,
    p_starts_at: inicio,
    p_nombre: nombre,
    p_telefono: telefono || null,
    p_email: email || null,
    p_notas: notas || null,
    p_tutor: paraOtro ? tutor : null,
    p_parentesco: paraOtro ? parentesco || null : null,
    p_origen: origen || null,
    p_referido: referido || null,
  })

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, '').trim()
    return { error: limpio || 'No pudimos registrar tu solicitud.', valores }
  }

  if (email) {
    await avisarQueLlegó({
      correo: email,
      quienAgenda: paraOtro ? tutor : nombre,
      paciente: nombre,
      esMenor: paraOtro,
      slug,
      inicio,
      token: String(token),
    })
  }

  return { confirmada: { cuando, medico, token: String(token) } }
}

/**
 * El acuse de que la solicitud llegó.
 *
 * **Nunca puede tumbar la reserva**: la cita ya quedó pedida, y un problema de
 * Resend no puede convertirse en "no pudimos registrar tu solicitud" para
 * alguien que sí la registró. Por eso va envuelto y lo peor que hace es
 * anotarse en `email_failures`.
 *
 * Va con la llave de servicio porque quien reserva no tiene sesión y el correo
 * del consultorio —el que se usa para que la respuesta le llegue a alguien— no
 * está en la vista pública, a propósito.
 */
async function avisarQueLlegó(d: {
  correo: string
  quienAgenda: string
  paciente: string
  esMenor: boolean
  slug: string
  inicio: string
  token: string
}) {
  try {
    if (problemaDelSitio()) return

    const admin = createAdminClient()
    const { data: consultorio } = await admin
      .from('professionals')
      .select('name, email, timezone')
      .eq('slug', d.slug)
      .maybeSingle<{ name: string; email: string | null; timezone: string }>()

    if (!consultorio) return

    const envio = await enviarCorreo({
      responder: consultorio.email,
      ...armarSolicitudRecibida({
        destinatario: { nombre: d.quienAgenda, correo: d.correo },
        paciente: d.paciente,
        esMenor: d.esMenor,
        doctor: consultorio.name,
        inicio: d.inicio,
        zona: consultorio.timezone,
        liga: `${process.env.NEXT_PUBLIC_SITE_URL}/cita/${d.token}`,
      }),
    })

    if (!envio.ok) await anotarFalloDeCorreo('solicitud', envio.error)
  } catch (err) {
    await anotarFalloDeCorreo('solicitud', String(err).slice(0, 200))
  }
}

export type EstadoDeclaracion = { error?: string; ok?: boolean }

/**
 * Lo que el paciente sabe de sí mismo, adelantado antes de la consulta.
 *
 * No entra al expediente: se guarda aparte, marcado como sin verificar, hasta
 * que el médico lo revise. Lo que escribe un paciente y lo que el médico
 * confirmó no son el mismo dato.
 */
export async function declararDatosMedicos(
  _estado: EstadoDeclaracion,
  datos: FormData,
): Promise<EstadoDeclaracion> {
  if (datos.get('consentimiento') !== 'on') {
    return { error: 'Necesitamos tu permiso para guardar datos de salud.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('declarar_datos_medicos', {
    p_token: String(datos.get('cita') ?? ''),
    p_consentimiento: true,
    p_alergias: String(datos.get('alergias') ?? '').trim() || null,
    p_padecimientos: String(datos.get('padecimientos') ?? '').trim() || null,
    p_medicamentos: String(datos.get('medicamentos') ?? '').trim() || null,
    p_tipo_sangre: String(datos.get('tipo_sangre') ?? '').trim() || null,
  })

  if (error) {
    return { error: error.message.replace(/^.*?:\s*/, '').trim() || 'No se pudo guardar.' }
  }

  return { ok: true }
}
