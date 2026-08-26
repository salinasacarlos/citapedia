import { FormularioAuth } from '@/components/formulario-auth'
import { entrar } from '@/lib/auth/actions'

export const metadata = { title: 'Entrar' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : ''

  return (
    <FormularioAuth
      accion={entrar}
      titulo="Entra a tu consultorio"
      descripcion="Para revisar solicitudes de cita y administrar tu agenda."
      cta="Entrar"
      ocultos={next ? { next } : undefined}
      campos={[
        { name: 'email', label: 'Correo', type: 'email', autoComplete: 'email' },
        {
          name: 'password',
          label: 'Contraseña',
          type: 'password',
          autoComplete: 'current-password',
        },
      ]}
      pie={{ texto: '¿Todavía no tienes consultorio?', enlace: 'Créalo', href: '/registro' }}
    />
  )
}
