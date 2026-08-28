import { exigirConsultorio } from '@/lib/consultorio'
import { exportarMetricas } from '@/lib/excel/metricas'
import { respuestaExcel } from '@/lib/excel/consultar'
import { leerPeriodo } from '@/lib/periodo'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { profesional } = await exigirConsultorio()
  const params = Object.fromEntries(new URL(request.url).searchParams)
  // El mismo periodo que la pantalla: descargar otra cosa de la que se está
  // viendo sería una sorpresa desagradable.
  const periodo = leerPeriodo(params, profesional.timezone)

  // Las fechas del NOMBRE son las que eligió el usuario: `hasta` es el inicio
  // del día siguiente —el fin es exclusivo— y en un archivo eso se lee como un
  // día de más.
  const resultado = await exportarMetricas(
    periodo.desde,
    periodo.hasta,
    periodo.etiqueta,
    `${periodo.desdeFecha}-a-${periodo.hastaFecha}`,
  )
  if (!resultado) return new Response('No hay nada que exportar.', { status: 404 })

  return respuestaExcel(resultado.buffer, resultado.archivo)
}
