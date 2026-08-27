import { Marca } from '@/components/marca'

export const metadata = { title: 'Cuenta suspendida' }

/**
 * Cuando la plataforma desactiva un consultorio, su gente sigue teniendo
 * sesión válida: mandarlos a /login los dejaría rebotando sin entender nada.
 * Esta pantalla dice qué pasó.
 */
export default function Suspendido() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex justify-center">
        <Marca href="/" />
      </div>
      <div className="tarjeta mt-8 p-6 text-center">
        <h1 className="text-xl font-bold text-ink">Tu cuenta está desactivada</h1>
        <p className="mt-2 text-sm text-muted">
          Tu agenda no está recibiendo citas y tu página pública no se ve. Tus datos
          siguen ahí, completos: reactivarla los devuelve tal como estaban.
        </p>
        <p className="mt-3 text-sm text-muted">Escríbenos para resolverlo.</p>
      </div>
    </main>
  )
}
