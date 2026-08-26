import { FormularioAuth } from '@/components/formulario-auth'
import { registrar } from '@/lib/auth/actions'

export const metadata = { title: 'Crear consultorio' }

export default function RegistroPage() {
  return (
    <FormularioAuth
      accion={registrar}
      titulo="Crea tu consultorio"
      descripcion="Al registrarte te creamos tu página pública y tu agenda. Después puedes invitar a tu asistente."
      cta="Crear consultorio"
      campos={[
        {
          name: 'name',
          label: 'Nombre',
          placeholder: 'Dra. Mariana Cordero',
          autoComplete: 'name',
          ayuda: 'Así aparecerá en tu página pública, y de aquí sale tu liga.',
        },
        {
          name: 'specialty',
          label: 'Especialidad',
          placeholder: 'Pediatría',
          required: false,
        },
        { name: 'email', label: 'Correo', type: 'email', autoComplete: 'email' },
        {
          name: 'password',
          label: 'Contraseña',
          type: 'password',
          autoComplete: 'new-password',
          ayuda: 'Mínimo 8 caracteres.',
        },
      ]}
      pie={{ texto: '¿Ya tienes cuenta?', enlace: 'Entra', href: '/login' }}
    />
  )
}
