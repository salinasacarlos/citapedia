import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { CambiarContrasena } from '@/components/cambiar-contrasena'
import { EliminarConsultorio } from '@/components/eliminar-consultorio'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi cuenta' }

export default async function CuentaPage() {
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Mi cuenta</h1>
        <p className="mt-1 text-sm text-muted">
          Tus datos de acceso. Lo que ven tus pacientes se edita en{' '}
          <span className="font-medium">Mi página</span>.
        </p>
      </header>

      <section className="tarjeta mb-5 p-4 sm:p-6">
        <h2 className="font-semibold text-ink">Correo de acceso</h2>
        <p className="mt-2 text-sm break-all text-muted">{user?.email}</p>
        <p className="mt-2 text-xs text-muted">
          Cambiar el correo exige confirmar el nuevo por mensaje, y todavía no
          mandamos correos. Se habilita cuando conectemos el envío.
        </p>
      </section>

      <section className="tarjeta mb-5 p-4 sm:p-6">
        <h2 className="font-semibold text-ink">Cambiar contraseña</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Te pedimos la de ahora para confirmar que eres tú.
        </p>
        <CambiarContrasena />
      </section>

      {esDueño && (
        <section className="rounded-marca border border-peligro/30 bg-peligro-suave/40 p-4 sm:p-6">
          <h2 className="font-semibold text-peligro">Eliminar el consultorio</h2>
          <p className="mt-1 text-sm text-muted">
            Se borran tu página pública, tu horario, todas tus citas y{' '}
            <strong className="font-semibold">el expediente de cada paciente</strong>:
            sus datos, alergias, padecimientos y notas de consulta. Esto no se puede
            deshacer.
          </p>
          <div className="mt-4">
            <EliminarConsultorio slug={profesional.slug} />
          </div>
        </section>
      )}
    </>
  )
}
