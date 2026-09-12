// El dominio que se le enseña al médico sale de la misma variable con la que se
// arman las ligas que se mandan. Escribirlo a mano dejaba en pantalla una
// dirección que todavía no existe, y la recepcionista la copiaba tal cual.
export function baseDelSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.citapedia.com').replace(/\/$/, '')
}

/**
 * El dominio como se dicta por teléfono, sin esquema y **sin `www.`**.
 *
 * El apex redirige al www, así que `citapedia.com/dr-jesus-garcia` abre igual
 * y es cuatro caracteres más corto de deletrear en el mostrador.
 */
export function dominioPublico() {
  return baseDelSitio()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
}

/**
 * Dice qué tiene de malo `NEXT_PUBLIC_SITE_URL`, o null si está bien.
 *
 * Es la variable con la que se arman todas las ligas que salen de aquí, y
 * equivocarla no se ve al ponerla: se ve días después, cuando un médico abre
 * su liga de acceso y le contesta otro servidor. Pasó —quedó con la URL de
 * Supabase y las ligas mandaban ahí, donde la respuesta es un error de apikey
 * que no dice nada de esto—. Más vale que la acción se niegue en la cara del
 * operador que entregar una liga rota que nadie va a revisar.
 */
export function problemaDelSitio(): string | null {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (!sitio) {
    return 'Falta NEXT_PUBLIC_SITE_URL en este entorno; sin ella las ligas salen incompletas.'
  }
  if (!/^https?:\/\//.test(sitio)) {
    return `NEXT_PUBLIC_SITE_URL debe empezar con https:// (hoy dice "${sitio}").`
  }
  if (/\.supabase\.(co|in)$/i.test(new URL(sitio).hostname)) {
    return (
      'NEXT_PUBLIC_SITE_URL apunta a Supabase, no al sitio: las ligas llevarían ' +
      'al médico a la base de datos. Debe ser la dirección de CitaPedia.'
    )
  }
  return null
}
