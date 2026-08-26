'use server'

import { createClient } from '@/lib/supabase/server'

export type EstadoReserva = {
  error?: string
  confirmada?: { cuando: string; medico: string }
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
  const medico = String(datos.get('medico') ?? '')
  const cuando = String(datos.get('cuando') ?? '')

  const valores = { nombre, telefono, email, notas, tutor, parentesco }

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
  const { error } = await supabase.rpc('solicitar_cita', {
    p_slug: slug,
    p_starts_at: inicio,
    p_nombre: nombre,
    p_telefono: telefono || null,
    p_email: email || null,
    p_notas: notas || null,
    p_tutor: paraOtro ? tutor : null,
    p_parentesco: paraOtro ? parentesco || null : null,
  })

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, '').trim()
    return { error: limpio || 'No pudimos registrar tu solicitud.', valores }
  }

  return { confirmada: { cuando, medico } }
}
