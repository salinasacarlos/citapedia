/**
 * Desde dónde se cuenta la fecha de una plantilla.
 *
 * Vive aparte de las acciones porque un archivo `'use server'` solo puede
 * exportar funciones async: cualquier constante ahí truena el build. Las
 * etiquetas se leen dentro de una frase —"A los 6 meses de _su nacimiento_"—,
 * así que van en minúscula y con el posesivo incluido.
 */
export const BASES = [
  { valor: 'nacimiento', etiqueta: 'su nacimiento' },
  { valor: 'ultima_visita', etiqueta: 'su última visita' },
  { valor: 'hoy', etiqueta: 'el día que se aplica' },
] as const
