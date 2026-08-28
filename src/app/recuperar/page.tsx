import { Marca } from '@/components/marca'
import { PedirRecuperacion } from '@/components/pedir-recuperacion'

export const metadata = { title: 'Recuperar el acceso' }

export default function Recuperar() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Marca href="/" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
        ¿Olvidaste tu contraseña?
      </h1>
      <p className="mt-2 text-sm text-muted">
        Te mandamos una liga para elegir una nueva. Tu agenda y tus pacientes se
        quedan como están.
      </p>
      <PedirRecuperacion />
    </main>
  )
}
