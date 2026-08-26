import { FormularioAuth } from '@/components/formulario-auth'
import { registrar } from '@/lib/auth/actions'

export const metadata = { title: 'Crear cuenta' }

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : ''
  const email = typeof params.email === 'string' ? params.email : ''
  // Quien llega desde una invitación se une a un consultorio que ya existe.
  const esAsistente = params.asistente === '1'

  return (
    <FormularioAuth
      accion={registrar}
      titulo={esAsistente ? 'Crea tu cuenta' : 'Crea tu consultorio'}
      descripcion={
        esAsistente
          ? 'Con esta cuenta vas a entrar al consultorio que te invitó.'
          : 'Al registrarte te creamos tu página pública y tu agenda. Después puedes invitar a tu asistente.'
      }
      cta={esAsistente ? 'Crear cuenta' : 'Crear consultorio'}
      ocultos={{
        ...(next ? { next } : {}),
        ...(esAsistente ? { asistente: '1' } : {}),
      }}
      campos={[
        {
          name: 'name',
          label: 'Nombre',
          placeholder: esAsistente ? 'Tu nombre' : 'Dra. Mariana Cordero',
          autoComplete: 'name',
          ayuda: esAsistente
            ? 'Para que el consultorio sepa quién eres.'
            : 'Así aparecerá en tu página pública, y de aquí sale tu liga.',
        },
        ...(esAsistente
          ? []
          : [
              {
                name: 'specialty',
                label: 'Especialidad',
                placeholder: 'Pediatría',
                required: false,
              },
            ]),
        {
          name: 'email',
          label: 'Correo',
          type: 'email',
          autoComplete: 'email',
          valorInicial: email,
          fijo: Boolean(email),
          ayuda: email ? 'Es el correo al que llegó la invitación.' : undefined,
        },
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
