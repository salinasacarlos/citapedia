import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { construirReceta } from '@/lib/receta/pdf'
import { fechaLarga } from '@/lib/fechas'

/**
 * Una receta de mentiras sobre el papel de verdad.
 *
 * Es la única forma honesta de ajustar los márgenes: dos números en
 * milímetros no se pueden evaluar en abstracto, pero sí se ve de un vistazo si
 * el texto le cae encima al membrete o le pisa la firma. Y se ve **antes** de
 * usarla con un paciente.
 */
export async function GET() {
  const { profesional, esDueño } = await exigirConsultorio()
  if (!esDueño) return new NextResponse('No autorizado.', { status: 403 })

  const supabase = await createClient()
  const { data: papel } = await supabase
    .from('prescription_paper')
    .select('path, mime, margen_arriba, margen_abajo')
    .eq('professional_id', profesional.id)
    .maybeSingle<{ path: string; mime: string; margen_arriba: number; margen_abajo: number }>()

  if (!papel) return new NextResponse('Todavía no has cargado tu papel.', { status: 409 })

  const { data: archivo, error } = await supabase.storage.from('papel-receta').download(papel.path)
  if (error || !archivo) return new NextResponse('No se pudo leer tu papel.', { status: 500 })

  const pdf = await construirReceta({
    paciente: 'Paciente de ejemplo',
    edad: '4 años',
    fecha: fechaLarga(new Date().toISOString(), profesional.timezone),
    // Lo suficientemente largo para que se note si el espacio no alcanza.
    medicamentos: [
      {
        medicamento: 'Amoxicilina suspensión 250 mg/5 ml',
        dosis: '5 ml',
        frecuencia: 'cada 8 horas',
        duracion: '7 días',
        indicaciones: 'Con alimentos. Terminar el frasco aunque se sienta mejor.',
      },
      {
        medicamento: 'Paracetamol gotas',
        dosis: '0.8 ml',
        frecuencia: 'cada 6 horas si hay fiebre',
        duracion: null,
        indicaciones: null,
      },
    ],
    indicacionesGenerales: 'Reposo dos días. Volver si la fiebre no cede en 48 horas.',
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
      'Content-Disposition': 'inline; filename="muestra-receta.pdf"',
      'Cache-Control': 'private, no-store',
    },
  })
}
