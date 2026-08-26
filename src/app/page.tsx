import Link from 'next/link'
import { Marca } from '@/components/marca'
import { obtenerConsultorio } from '@/lib/consultorio'

export const dynamic = 'force-dynamic'

const PASOS = [
  {
    titulo: 'Tu página, tu cara',
    texto:
      'Una liga propia con tu foto, tu formación y cómo es tu consulta. Se la mandas a una mamá y ya sabe quién eres.',
  },
  {
    titulo: 'Tú decides cada cita',
    texto:
      'Los pacientes solicitan; tú aceptas o rechazas. Nada entra a tu agenda sin que lo apruebes.',
  },
  {
    titulo: 'Los horarios se calculan solos',
    texto:
      'Defines tu semana una vez. Los huecos salen de restarle a tu horario las citas confirmadas y tus bloqueos.',
  },
  {
    titulo: 'Nadie se olvida',
    texto:
      'Recordatorios automáticos por correo antes de cada cita, con el texto y la anticipación que tú elijas.',
  },
]

export default async function Home() {
  const consultorio = await obtenerConsultorio()

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <Marca href={null} />
        <nav className="flex items-center gap-2">
          {consultorio ? (
            <Link href="/admin" className="boton boton-primario">
              Ir a mi consultorio
            </Link>
          ) : (
            <>
              <Link href="/login" className="boton boton-suave">
                Entrar
              </Link>
              <Link href="/registro" className="boton boton-primario">
                Crear consultorio
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="text-sm font-semibold text-brand">Cuidarlos es primero</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            La agenda de tu consultorio, sin llamadas ni libreta
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            CitaPedia le da a cada pediatra una página propia donde los papás ven sus
            horarios y solicitan cita. Tú apruebas cada una, desde el celular, entre
            paciente y paciente.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/registro" className="boton boton-primario px-5 py-3">
              Crear mi consultorio
            </Link>
            <Link href="/login" className="boton boton-suave px-5 py-3">
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Sin pagos de por medio: CitaPedia agenda, tú cobras como siempre.
          </p>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {PASOS.map((paso) => (
            <div key={paso.titulo} className="tarjeta p-6">
              <h2 className="font-bold text-ink">{paso.titulo}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{paso.texto}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Marca href={null} />
          <p>Hecho para pediatras.</p>
        </div>
      </footer>
    </div>
  )
}
