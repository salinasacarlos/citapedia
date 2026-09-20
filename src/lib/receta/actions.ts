'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { medirPapel } from '@/lib/receta/medir'

export type ResultadoPapel = { error?: string; ok?: string }

const BUCKET = 'papel-receta'
const TIPOS = ['application/pdf', 'image/png', 'image/jpeg']
const MAX = 5 * 1024 * 1024

/**
 * Guarda el papel membretado del consultorio.
 *
 * Es de solo dueño porque trae su cédula y muchas veces su firma escaneada.
 * Un asistente que pudiera cambiarlo podría imprimir recetas con otro papel.
 */
export async function subirPapelDeReceta(
  _estado: ResultadoPapel,
  datos: FormData,
): Promise<ResultadoPapel> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Solo el médico puede cambiar su papel de recetas.' }

  const archivo = datos.get('papel')
  if (!(archivo instanceof File) || archivo.size === 0) return { error: 'Elige un archivo.' }
  if (!TIPOS.includes(archivo.type)) return { error: 'Tiene que ser PDF, PNG o JPG.' }
  if (archivo.size > MAX) {
    return { error: `Pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo son 5 MB.` }
  }

  // Se mira la hoja antes de guardarla: dónde termina el membrete y dónde
  // empieza la firma. Es la diferencia entre un valor por defecto que nadie
  // tocó y un número propuesto sobre SU papel, que el médico solo confirma.
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const medido = await medirPapel(bytes, archivo.type)

  const supabase = await createClient()
  const extension = archivo.type === 'application/pdf' ? 'pdf' : archivo.type.split('/')[1]
  const ruta = `${profesional.id}/papel-${Date.now()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: archivo.type, upsert: false })
  if (errorSubida) return { error: errorSubida.message }

  const { data: anterior } = await supabase
    .from('prescription_paper')
    .select('path')
    .eq('professional_id', profesional.id)
    .maybeSingle<{ path: string }>()

  const { error } = await supabase.from('prescription_paper').upsert(
    {
      professional_id: profesional.id,
      path: ruta,
      mime: archivo.type,
      margen_arriba: medido.arriba,
      margen_abajo: medido.abajo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'professional_id' },
  )

  if (error) {
    // Sin la fila, el archivo no le sirve a nadie: se limpia, como en las fotos.
    await supabase.storage.from(BUCKET).remove([ruta])
    return { error: error.message }
  }

  if (anterior?.path && anterior.path !== ruta) {
    await supabase.storage.from(BUCKET).remove([anterior.path])
  }

  revalidatePath('/admin/horario')
  return {
    ok: medido.seguro
      ? `Papel guardado. Medí tu hoja: ${medido.arriba} mm arriba y ${medido.abajo} mm abajo. Revísalo con la muestra.`
      : 'Papel guardado. No pude medir dónde termina tu membrete, así que puse valores de partida: ajústalos con la muestra.',
  }
}

/**
 * Cuánto espacio respetar arriba y abajo.
 *
 * Son los dos números que evitan un editor de coordenadas: una hoja membretada
 * tiene el encabezado arriba, la firma abajo y el centro vacío.
 */
export async function guardarMargenesDeReceta(
  _estado: ResultadoPapel,
  datos: FormData,
): Promise<ResultadoPapel> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return { error: 'Solo el médico puede cambiarlo.' }

  const arriba = Number(datos.get('margen_arriba'))
  const abajo = Number(datos.get('margen_abajo'))
  const sensato = (n: number) => Number.isInteger(n) && n >= 0 && n <= 200
  if (!sensato(arriba) || !sensato(abajo)) return { error: 'Los márgenes van de 0 a 200 mm.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('prescription_paper')
    .update({ margen_arriba: arriba, margen_abajo: abajo, updated_at: new Date().toISOString() })
    .eq('professional_id', profesional.id)

  if (error) return { error: error.message }

  revalidatePath('/admin/horario')
  return { ok: 'Márgenes guardados.' }
}

export async function quitarPapelDeReceta(): Promise<void> {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return

  const supabase = await createClient()
  const { data } = await supabase
    .from('prescription_paper')
    .select('path')
    .eq('professional_id', profesional.id)
    .maybeSingle<{ path: string }>()

  await supabase.from('prescription_paper').delete().eq('professional_id', profesional.id)
  if (data?.path) await supabase.storage.from(BUCKET).remove([data.path])

  revalidatePath('/admin/horario')
}
