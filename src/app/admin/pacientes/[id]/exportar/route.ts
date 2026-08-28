import { exportarPacientes, respuestaExcel } from '@/lib/excel/consultar'

export const dynamic = 'force-dynamic'

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Qué llevarse. Sin `hojas` van todas, para que una liga vieja siga
  // descargando el expediente completo.
  const pedidas = new URL(peticion.url).searchParams.getAll('hoja')

  // RLS decide: si el paciente no es de este consultorio, no hay nada que armar.
  const resultado = await exportarPacientes(id, pedidas.length > 0 ? pedidas : undefined)
  if (!resultado) {
    return new Response('No encontramos ese paciente.', { status: 404 })
  }
  return respuestaExcel(resultado.buffer, resultado.archivo)
}
