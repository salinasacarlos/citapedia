import { exportarPacientes, respuestaExcel } from '@/lib/excel/consultar'

export const dynamic = 'force-dynamic'

export async function GET() {
  const resultado = await exportarPacientes()
  if (!resultado) {
    return new Response('No hay pacientes que exportar.', { status: 404 })
  }
  return respuestaExcel(resultado.buffer, resultado.archivo)
}
