import { FormularioAuth } from '@/components/formulario-auth'
import { entrar } from '@/lib/auth/actions'

export const metadata = { title: 'Entrar' }

export default function LoginPage() {
  return (
    <FormularioAuth
      accion={entrar}
      titulo="Entra a tu consultorio"
      descripcion="Para revisar solicitudes de cita y administrar tu agenda."
      cta="Entrar"
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
