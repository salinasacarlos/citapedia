/**
 * De dónde llegó el paciente.
 *
 * Las opciones son las que se pueden accionar distinto, no las que suenan
 * bonito en un reporte: a un colega que refiere se le llama, a un paciente que
 * recomienda se le agradece, y un directorio se paga. Por eso están separados
 * aunque los tres podrían caber en "recomendación".
 */
type Opcion = { valor: string; etiqueta: string; pregunta?: string }

export const ORIGENES: readonly Opcion[] = [
  { valor: 'paciente', etiqueta: 'Me recomendó un paciente', pregunta: '¿Quién?' },
  { valor: 'medico', etiqueta: 'Me refirió otro médico', pregunta: '¿Cuál médico?' },
  { valor: 'internet', etiqueta: 'Lo busqué en internet' },
  { valor: 'redes', etiqueta: 'Redes sociales' },
  { valor: 'directorio', etiqueta: 'Un directorio médico (Doctoralia y similares)' },
  { valor: 'seguro', etiqueta: 'Mi seguro o un convenio' },
  { valor: 'paso', etiqueta: 'Vi el consultorio al pasar' },
  { valor: 'recurrente', etiqueta: 'Ya soy paciente de aquí' },
  { valor: 'otro', etiqueta: 'Otro' },
]

/** Los que piden un nombre después: hay a quién agradecerle o a quién llamar. */
export function pideQuien(valor: string): string | null {
  return ORIGENES.find((o) => o.valor === valor)?.pregunta ?? null
}

/** Cómo se lee en la ficha, ya guardado. */
export function describirOrigen(valor: string | null, referido: string | null): string | null {
  if (!valor) return null
  const opcion = ORIGENES.find((o) => o.valor === valor)
  if (!opcion) return valor
  // En la ficha se lee desde el consultorio, no desde el paciente.
  const desdeElConsultorio: Record<string, string> = {
    paciente: 'Lo recomendó un paciente',
    medico: 'Lo refirió otro médico',
    internet: 'Búsqueda en internet',
    redes: 'Redes sociales',
    directorio: 'Directorio médico',
    seguro: 'Seguro o convenio',
    paso: 'Vio el consultorio al pasar',
    recurrente: 'Ya era paciente',
    otro: 'Otro',
  }
  const texto = desdeElConsultorio[valor] ?? opcion.etiqueta
  return referido ? `${texto}: ${referido}` : texto
}
