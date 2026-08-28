'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'

export type ResultadoCuenta = { error?: string; ok?: string }

export async function cambiarContrasena(
  _estado: ResultadoCuenta,
  datos: FormData,
): Promise<ResultadoCuenta> {
  const actual = String(datos.get('actual') ?? '')
  const nueva = String(datos.get('nueva') ?? '')
  const repetida = String(datos.get('repetida') ?? '')

  if (nueva.length < 8) return { error: 'La contraseña nueva necesita al menos 8 caracteres.' }
  if (nueva !== repetida) return { error: 'Las dos contraseñas nuevas no coinciden.' }
  if (nueva === actual) return { error: 'La contraseña nueva es igual a la de ahora.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Tu sesión venció. Entra otra vez.' }

  // Pedimos la contraseña de ahora a propósito: si alguien deja la sesión
  // abierta en una computadora del consultorio, no debe poder cambiarla y
  // dejar fuera al dueño.
  const { error: errorActual } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: actual,
  })
  if (errorActual) return { error: 'La contraseña de ahora no es correcta.' }

  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) {
    return {
      error: /at least|weak|short/i.test(error.message)
        ? 'Esa contraseña es demasiado débil.'
        : error.message,
    }
  }

  return { ok: 'Contraseña actualizada.' }
}

/**
 * Cierra el consultorio archivándolo, no borrándolo.
 *
 * Antes hacía `delete` y la cascada se llevaba pacientes, citas, expedientes,
 * notas y estudios. La norma del expediente clínico pide conservarlo cinco
 * años: para el médico el efecto es el mismo —deja de funcionar y su página
 * desaparece— pero los datos siguen ahí por si alguien los reclama.
 */
export async function eliminarConsultorio(
  _estado: ResultadoCuenta,
  datos: FormData,
): Promise<ResultadoCuenta> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Solo el dueño del consultorio puede cerrarlo.' }

  // Escribir el slug es la confirmación: un "¿estás seguro?" se acepta por
  // reflejo, y esto apaga la agenda completa.
  const confirmacion = String(datos.get('confirmacion') ?? '').trim()
  if (confirmacion !== profesional.slug) {
    return { error: `Escribe exactamente “${profesional.slug}” para confirmar.` }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archivar_consultorio', {
    p_id: profesional.id,
    p_motivo: String(datos.get('motivo') ?? '').trim() || null,
  })
  if (error) return { error: error.message.replace(/^.*?:\s*/, '') }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/?consultorio=archivado')
}
