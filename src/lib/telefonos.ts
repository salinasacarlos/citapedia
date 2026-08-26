/**
 * Ladas internacionales para capturar teléfonos sin adivinar.
 *
 * Antes se asumía México cuando el número traía diez dígitos. Eso funciona
 * hasta el primer paciente que da un número de Estados Unidos —también de diez
 * dígitos— y el mensaje se va a un desconocido en Guadalajara.
 */

export type Lada = {
  codigo: string
  pais: string
  bandera: string
  /** Dígitos del número nacional, cuando el país tiene largo fijo. */
  digitos?: number
}

/** Los que un consultorio mexicano ve todos los días, arriba de la lista. */
export const LADAS_FRECUENTES: Lada[] = [
  { codigo: '52', pais: 'México', digitos: 10, bandera: '🇲🇽' },
  { codigo: '1', pais: 'Estados Unidos y Canadá', digitos: 10, bandera: '🇺🇸' },
  { codigo: '34', pais: 'España', digitos: 9, bandera: '🇪🇸' },
  { codigo: '57', pais: 'Colombia', digitos: 10, bandera: '🇨🇴' },
  { codigo: '54', pais: 'Argentina', digitos: 10, bandera: '🇦🇷' },
]

export const LADAS: Lada[] = [
  { codigo: '93', pais: 'Afganistán', bandera: '🇦🇫' },
  { codigo: '49', pais: 'Alemania', bandera: '🇩🇪' },
  { codigo: '376', pais: 'Andorra', bandera: '🇦🇩' },
  { codigo: '244', pais: 'Angola', bandera: '🇦🇴' },
  { codigo: '966', pais: 'Arabia Saudita', bandera: '🇸🇦' },
  { codigo: '213', pais: 'Argelia', bandera: '🇩🇿' },
  { codigo: '54', pais: 'Argentina', digitos: 10, bandera: '🇦🇷' },
  { codigo: '61', pais: 'Australia', bandera: '🇦🇺' },
  { codigo: '43', pais: 'Austria', bandera: '🇦🇹' },
  { codigo: '32', pais: 'Bélgica', bandera: '🇧🇪' },
  { codigo: '501', pais: 'Belice', bandera: '🇧🇿' },
  { codigo: '591', pais: 'Bolivia', digitos: 8, bandera: '🇧🇴' },
  { codigo: '55', pais: 'Brasil', digitos: 11, bandera: '🇧🇷' },
  { codigo: '359', pais: 'Bulgaria', bandera: '🇧🇬' },
  { codigo: '855', pais: 'Camboya', bandera: '🇰🇭' },
  { codigo: '237', pais: 'Camerún', bandera: '🇨🇲' },
  { codigo: '56', pais: 'Chile', digitos: 9, bandera: '🇨🇱' },
  { codigo: '86', pais: 'China', bandera: '🇨🇳' },
  { codigo: '357', pais: 'Chipre', bandera: '🇨🇾' },
  { codigo: '57', pais: 'Colombia', digitos: 10, bandera: '🇨🇴' },
  { codigo: '82', pais: 'Corea del Sur', bandera: '🇰🇷' },
  { codigo: '506', pais: 'Costa Rica', digitos: 8, bandera: '🇨🇷' },
  { codigo: '385', pais: 'Croacia', bandera: '🇭🇷' },
  { codigo: '53', pais: 'Cuba', bandera: '🇨🇺' },
  { codigo: '45', pais: 'Dinamarca', bandera: '🇩🇰' },
  { codigo: '593', pais: 'Ecuador', digitos: 9, bandera: '🇪🇨' },
  { codigo: '20', pais: 'Egipto', bandera: '🇪🇬' },
  { codigo: '503', pais: 'El Salvador', digitos: 8, bandera: '🇸🇻' },
  { codigo: '971', pais: 'Emiratos Árabes Unidos', bandera: '🇦🇪' },
  { codigo: '421', pais: 'Eslovaquia', bandera: '🇸🇰' },
  { codigo: '386', pais: 'Eslovenia', bandera: '🇸🇮' },
  { codigo: '34', pais: 'España', digitos: 9, bandera: '🇪🇸' },
  { codigo: '1', pais: 'Estados Unidos y Canadá', digitos: 10, bandera: '🇺🇸' },
  { codigo: '372', pais: 'Estonia', bandera: '🇪🇪' },
  { codigo: '63', pais: 'Filipinas', bandera: '🇵🇭' },
  { codigo: '358', pais: 'Finlandia', bandera: '🇫🇮' },
  { codigo: '33', pais: 'Francia', bandera: '🇫🇷' },
  { codigo: '233', pais: 'Ghana', bandera: '🇬🇭' },
  { codigo: '30', pais: 'Grecia', bandera: '🇬🇷' },
  { codigo: '502', pais: 'Guatemala', digitos: 8, bandera: '🇬🇹' },
  { codigo: '509', pais: 'Haití', bandera: '🇭🇹' },
  { codigo: '504', pais: 'Honduras', digitos: 8, bandera: '🇭🇳' },
  { codigo: '36', pais: 'Hungría', bandera: '🇭🇺' },
  { codigo: '91', pais: 'India', bandera: '🇮🇳' },
  { codigo: '62', pais: 'Indonesia', bandera: '🇮🇩' },
  { codigo: '353', pais: 'Irlanda', bandera: '🇮🇪' },
  { codigo: '972', pais: 'Israel', bandera: '🇮🇱' },
  { codigo: '39', pais: 'Italia', bandera: '🇮🇹' },
  { codigo: '81', pais: 'Japón', bandera: '🇯🇵' },
  { codigo: '254', pais: 'Kenia', bandera: '🇰🇪' },
  { codigo: '371', pais: 'Letonia', bandera: '🇱🇻' },
  { codigo: '961', pais: 'Líbano', bandera: '🇱🇧' },
  { codigo: '370', pais: 'Lituania', bandera: '🇱🇹' },
  { codigo: '352', pais: 'Luxemburgo', bandera: '🇱🇺' },
  { codigo: '60', pais: 'Malasia', bandera: '🇲🇾' },
  { codigo: '212', pais: 'Marruecos', bandera: '🇲🇦' },
  { codigo: '52', pais: 'México', digitos: 10, bandera: '🇲🇽' },
  { codigo: '234', pais: 'Nigeria', bandera: '🇳🇬' },
  { codigo: '47', pais: 'Noruega', bandera: '🇳🇴' },
  { codigo: '64', pais: 'Nueva Zelanda', bandera: '🇳🇿' },
  { codigo: '31', pais: 'Países Bajos', bandera: '🇳🇱' },
  { codigo: '92', pais: 'Pakistán', bandera: '🇵🇰' },
  { codigo: '507', pais: 'Panamá', digitos: 8, bandera: '🇵🇦' },
  { codigo: '595', pais: 'Paraguay', digitos: 9, bandera: '🇵🇾' },
  { codigo: '51', pais: 'Perú', digitos: 9, bandera: '🇵🇪' },
  { codigo: '48', pais: 'Polonia', bandera: '🇵🇱' },
  { codigo: '351', pais: 'Portugal', bandera: '🇵🇹' },
  { codigo: '44', pais: 'Reino Unido', digitos: 10, bandera: '🇬🇧' },
  { codigo: '1809', pais: 'República Dominicana', bandera: '🇩🇴' },
  { codigo: '420', pais: 'República Checa', bandera: '🇨🇿' },
  { codigo: '40', pais: 'Rumania', bandera: '🇷🇴' },
  { codigo: '7', pais: 'Rusia y Kazajistán', bandera: '🇷🇺' },
  { codigo: '221', pais: 'Senegal', bandera: '🇸🇳' },
  { codigo: '65', pais: 'Singapur', bandera: '🇸🇬' },
  { codigo: '27', pais: 'Sudáfrica', bandera: '🇿🇦' },
  { codigo: '46', pais: 'Suecia', bandera: '🇸🇪' },
  { codigo: '41', pais: 'Suiza', bandera: '🇨🇭' },
  { codigo: '66', pais: 'Tailandia', bandera: '🇹🇭' },
  { codigo: '886', pais: 'Taiwán', bandera: '🇹🇼' },
  { codigo: '90', pais: 'Turquía', bandera: '🇹🇷' },
  { codigo: '380', pais: 'Ucrania', bandera: '🇺🇦' },
  { codigo: '598', pais: 'Uruguay', digitos: 8, bandera: '🇺🇾' },
  { codigo: '58', pais: 'Venezuela', digitos: 10, bandera: '🇻🇪' },
  { codigo: '84', pais: 'Vietnam', bandera: '🇻🇳' },
]

export const LADA_MEXICO = '52'

/** Cuántos dígitos espera un país, si tiene largo fijo. */
export function digitosDe(codigo: string): number | undefined {
  return (
    LADAS_FRECUENTES.find((l) => l.codigo === codigo)?.digitos ??
    LADAS.find((l) => l.codigo === codigo)?.digitos
  )
}

/** '52' + '55 7070 8080' → '+52 5570708080' */
export function componerTelefono(lada: string, numero: string): string | null {
  const digitos = numero.replace(/\D/g, '')
  if (digitos === '') return null
  return `+${lada} ${digitos}`
}

/**
 * Devuelve el problema con el número, o null si está bien. En los países con
 * largo fijo se exige exacto: un dígito de menos manda el mensaje a nadie.
 */
export function revisarTelefono(lada: string, numero: string): string | null {
  const digitos = numero.replace(/\D/g, '')
  if (digitos === '') return null

  const esperados = digitosDe(lada)
  if (esperados && digitos.length !== esperados) {
    return `Ese país usa ${esperados} dígitos y escribiste ${digitos.length}.`
  }
  if (!esperados && (digitos.length < 6 || digitos.length > 14)) {
    return 'Ese número no parece completo.'
  }
  return null
}

/** Separa un teléfono guardado para volver a mostrarlo en el formulario. */
export function separarTelefono(
  telefono: string | null | undefined,
): { lada: string; numero: string } {
  if (!telefono) return { lada: LADA_MEXICO, numero: '' }

  const texto = telefono.trim()
  if (!texto.startsWith('+')) return { lada: LADA_MEXICO, numero: texto }

  const digitos = texto.slice(1).replace(/\D/g, '')
  // Se prueban las ladas más largas primero: '1809' antes que '1'.
  const codigos = [...new Set(LADAS.map((l) => l.codigo))].sort(
    (a, b) => b.length - a.length,
  )
  for (const codigo of codigos) {
    if (digitos.startsWith(codigo)) {
      const resto = texto.slice(1 + codigo.length).trim()
      return { lada: codigo, numero: resto || digitos.slice(codigo.length) }
    }
  }
  return { lada: LADA_MEXICO, numero: texto }
}
