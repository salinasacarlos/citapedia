import { exportarPacientes, respuestaExcel } from '@/lib/excel/consultar'

export const dynamic = 'force-dynamic'

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // RLS decide: si el paciente no es de este consultorio, no hay nada que armar.
  const resultado = await exportarPacientes(id)
  if (!resultado) {
    return new Response('No encontramos ese paciente.', { status: 404 })
  }
  return respuestaExcel(resultado.buffer, resultado.archivo)
}
