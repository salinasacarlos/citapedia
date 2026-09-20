import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { construirReceta, type MedicamentoImpreso } from '@/lib/receta/pdf'
import { edad, fechaLarga } from '@/lib/fechas'

/**
 * La receta de una consulta, en PDF, sobre el papel del médico.
 *
 * Se abre en el navegador (`inline`) y no se descarga: lo que se quiere casi
 * siempre es imprimirla ahí mismo, con el paciente todavía enfrente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ citaId: string }> },
) {
  const { citaId } = await params
  const { profesional, esDueño } = await exigirConsultorio()
  // Recetar es del médico. RLS lo impediría igual, pero un PDF vacío sería
  // una forma rara de decir que no.
  if (!esDueño) return new NextResponse('No autorizado.', { status: 403 })

  const supabase = await createClient()

  const { data: nota } = await supabase
    .from('consultation_notes')
    .select('id, treatment, created_at, patients(name, birth_date)')
    .eq('appointment_id', citaId)
    .maybeSingle<{
      id: string
      treatment: string | null
      created_at: string
      patients: { name: string; birth_date: string | null } | null
    }>()

  if (!nota) return new NextResponse('Esa consulta todavía no tiene nota.', { status: 404 })

  const [{ data: medicamentos }, { data: papel }] = await Promise.all([
    supabase
      .from('consultation_medications')
      .select('medicamento, dosis, frecuencia, duracion, indicaciones')
      .eq('consultation_note_id', nota.id)
      .is('archived_at', null)
      .order('created_at')
      .returns<MedicamentoImpreso[]>(),
    supabase
      .from('prescription_paper')
      .select('path, mime, margen_arriba, margen_abajo')
      .eq('professional_id', profesional.id)
      .maybeSingle<{ path: string; mime: string; margen_arriba: number; margen_abajo: number }>(),
  ])

  // Sin papel no se imprime nada. Una hoja en blanco con dos medicamentos
  // parece una receta y no lo es: le faltaría la cédula, el domicilio y la
  // firma, que es justo lo que la hace válida.
  if (!papel) {
    return new NextResponse(
      'Todavía no has cargado tu papel de recetas. Se sube en Tu consultorio.',
      { status: 409 },
    )
  }

  if (!medicamentos || medicamentos.length === 0) {
    return new NextResponse('Esta consulta no tiene medicamentos anotados.', { status: 409 })
  }

  const { data: archivo, error } = await supabase.storage
    .from('papel-receta')
    .download(papel.path)

  if (error || !archivo) {
    return new NextResponse('No se pudo leer tu papel de recetas.', { status: 500 })
  }

  const pdf = await construirReceta({
    paciente: nota.patients?.name ?? 'Paciente',
    edad: nota.patients?.birth_date ? edad(nota.patients.birth_date) : null,
    fecha: fechaLarga(nota.created_at, profesional.timezone),
    medicamentos,
    indicacionesGenerales: nota.treatment,
    papel: {
      bytes: new Uint8Array(await archivo.arrayBuffer()),
      mime: papel.mime,
      margenArriba: papel.margen_arriba,
      margenAbajo: papel.margen_abajo,
    },
  })

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="receta.pdf"',
      // Lleva datos de salud con nombre: que no se quede en ninguna caché.
      'Cache-Control': 'private, no-store',
    },
  })
}
