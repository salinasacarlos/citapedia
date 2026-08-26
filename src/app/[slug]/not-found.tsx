import Link from 'next/link'
import { Marca } from '@/components/marca'

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>
      <h1 className="mt-8 text-2xl font-bold text-ink">No encontramos ese consultorio</h1>
      <p className="mt-2 text-muted">
        Puede que la liga esté mal escrita o que el médico la haya cambiado.
      </p>
      <Link href="/" className="boton boton-suave mx-auto mt-6">
        Ir al inicio
      </Link>
    </main>
  )
}
