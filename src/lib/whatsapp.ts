/**
 * Ligas de WhatsApp para que la recepcionista escriba sin teclear.
 *
 * El número se arma al construir la liga, no al guardarlo: los teléfonos
 * entran como cada quien los escribe —"+52 55 7070 8080", "5570708080",
 * "(55) 7070-8080"— y reescribirlos en la base sería destruir lo que el
 * consultorio capturó. Aquí se interpreta y, si no se entiende, no se ofrece
 * el botón en vez de abrir un chat con un número equivocado.
 */

/** México por defecto; se puede cambiar cuando haya consultorios fuera. */
const LADA_POR_DEFECTO = '52'

export function numeroParaWhatsApp(
  telefono: string | null | undefined,
  lada = LADA_POR_DEFECTO,
): string | null {
  if (!telefono) return null

  // Un '+' al inicio significa que la lada ya viene en el número: no hay nada
  // que adivinar, y adivinar de todos modos mandaría el mensaje a otro país.
  const yaInternacional = telefono.trim().startsWith('+')

  const soloDigitos = telefono.replace(/\D/g, '')
  if (soloDigitos.length === 0) return null

  if (yaInternacional) {
    return soloDigitos.length >= 8 && soloDigitos.length <= 15 ? soloDigitos : null
  }

  // Prefijo internacional escrito como 00.
  const sinCeros = soloDigitos.replace(/^00/, '')

  // Diez dígitos: un número nacional sin lada de país.
  if (sinCeros.length === 10) return `${lada}${sinCeros}`

  // México dejó de usar el "1" después del 52 para celulares en 2019, pero
  // sigue apareciendo en agendas viejas.
  if (sinCeros.length === 13 && sinCeros.startsWith('521')) {
    return `52${sinCeros.slice(3)}`
  }

  // Ya trae lada de país.
  if (sinCeros.length >= 11 && sinCeros.length <= 15) return sinCeros

  // Cualquier otra cosa es un dato incompleto: mejor no ofrecer el botón.
  return null
}

/**
 * Rellena la plantilla del consultorio. Si falta un dato, se quita el hueco
 * en vez de dejar un "{paciente}" a la vista del paciente.
 */
export function armarMensaje(
  plantilla: string,
  datos: { paciente: string; doctor: string; fecha: string; hora: string },
): string {
  return plantilla
    .replace(/\{paciente\}/g, datos.paciente)
    .replace(/\{doctor\}/g, datos.doctor)
    .replace(/\{fecha\}/g, datos.fecha)
    .replace(/\{hora\}/g, datos.hora)
    .replace(/\s+/g, ' ')
    // "a las {hora}." con hora = "6:30 p.m." deja "p.m..". Pasa con cualquier
    // plantilla que cierre con punto, así que se limpia aquí y no pidiéndole
    // al médico que escriba con cuidado.
    .replace(/\.{2,}/g, '.')
    .trim()
}

/**
 * `wa.me` decide sola entre la app y WhatsApp Web según el dispositivo, que
 * es justo lo que se necesita: la recepcionista en la computadora y el médico
 * en el celular abren lo que tienen.
 */
export function ligaWhatsApp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

/** A quién se le escribe: al paciente, o a quien responde por él. */
export function contactoParaConfirmar(paciente: {
  name: string
  phone: string | null
  is_minor: boolean | null
  tutor_name: string | null
  tutor_phone: string | null
}): { nombre: string; telefono: string } | null {
  if (paciente.is_minor && paciente.tutor_phone) {
    return { nombre: paciente.tutor_name ?? 'el responsable', telefono: paciente.tutor_phone }
  }
  if (paciente.phone) return { nombre: paciente.name, telefono: paciente.phone }
  if (paciente.tutor_phone) {
    return { nombre: paciente.tutor_name ?? 'el responsable', telefono: paciente.tutor_phone }
  }
  return null
}
