import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Deja constancia de un envío que no salió.
 *
 * **Nunca recibe el destinatario ni la liga.** En recuperación la dirección es
 * el dato que no debe quedar registrado —sería una lista de quién tiene
 * cuenta—, en recordatorios es el correo de un paciente, y la liga es una
 * credencial: escribirla en una tabla o en un log la vuelve reutilizable por
 * quien lea cualquiera de los dos.
 *
 * Falla en silencio: anotar que algo salió mal no puede ser lo que rompa la
 * operación que ya venía mal.
 */
export async function anotarFalloDeCorreo(kind: string, reason: string): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY) return

  try {
    await createAdminClient()
      .from('email_failures')
      .insert({ kind, reason: reason.slice(0, 300) })
  } catch {
    // Ni una palabra: no hay nadie a quien decírselo.
  }
}
