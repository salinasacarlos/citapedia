// El dominio que se le enseña al médico sale de la misma variable con la que se
// arman las ligas que se mandan. Escribirlo a mano dejaba en pantalla una
// dirección que todavía no existe, y la recepcionista la copiaba tal cual.
export function dominioPublico() {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://citapedia.vercel.app'
  return sitio.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
