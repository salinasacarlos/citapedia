import { Marca } from '@/components/marca'

export const metadata = { title: 'Consultorio cerrado' }

/**
 * Para quien cerró su consultorio y vuelve a entrar.
 *
 * Su sesión sigue siendo válida, así que mandarlo a /login lo dejaría
 * rebotando. Y lo que más va a querer saber es si sus datos siguen ahí.
 */
export default function Archivado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>
      <div className="tarjeta mt-8 p-6 text-center">
        <h1 className="text-xl font-bold text-ink">Tu consultorio está cerrado</h1>
        <p className="mt-2 text-sm text-muted">
          Tu agenda ya no recibe citas y tu página pública no se ve.
        </p>
        <p className="mt-3 text-sm text-muted">
          Tus expedientes <strong className="text-foreground">no se borraron</strong>: se
          conservan cinco años, como pide la norma. Si necesitas recuperarlos, o volver a
          abrir, escríbenos.
        </p>
      </div>
    </main>
  )
}
