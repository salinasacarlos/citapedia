import { FormularioAuth } from '@/components/formulario-auth'
import { entrar } from '@/lib/auth/actions'

export const metadata = { title: 'Entrar' }

/**
 * La misma puerta sirve para dos cosas muy distintas, así que lo dice: quien
 * viene de `/plataforma` no está entrando a un consultorio, y ofrecerle "crea
 * el tuyo" no tendría sentido.
 */
function comoEntrar(next: string) {
  if (next.startsWith('/plataforma')) {
    return {
      distintivo: 'Plataforma',
      titulo: 'Consola de operación',
      descripcion:
        'Para dar de alta consultorios, activarlos o desactivarlos y ver cómo va el uso. Aquí no se ve nada clínico.',
      pie: undefined,
    }
  }
  return {
    distintivo: undefined,
    titulo: 'Entra a tu consultorio',
    descripcion: 'Para revisar solicitudes de cita y administrar tu agenda.',
    pie: { texto: '¿Todavía no tienes consultorio?', enlace: 'Créalo', href: '/registro' },
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : ''
  const copy = comoEntrar(next)

  return (
    <FormularioAuth
      accion={entrar}
      distintivo={copy.distintivo}
      titulo={copy.titulo}
      descripcion={copy.descripcion}
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
      pie={copy.pie}
    />
  )
}
