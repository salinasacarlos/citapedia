'use client'

import { useActionState } from 'react'
import { regenerarAcceso, type ResultadoPlataforma } from '@/lib/plataforma/actions'
import { CopiarLiga } from './copiar-liga'

/**
 * "No puedo entrar" es de las llamadas más frecuentes, y hasta ahora la única
 * salida era entrar a Supabase a mano. La liga se muestra en pantalla en vez
 * de mandarse por correo: sin dominio verificado el correo no llega, y quien
 * está en la llamada la puede pegar donde el médico la esté esperando.
 */
export function LigaDeAcceso({ id, email }: { id: string; email: string }) {
  const [estado, formAction, pendiente] = useActionState<ResultadoPlataforma, FormData>(
    regenerarAcceso,
    {},
  )

  return (
    <div className="mt-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="email" value={email} />
        <button
          disabled={pendiente}
          className="text-xs font-medium text-acento hover:underline disabled:opacity-50"
        >
          {pendiente ? 'Generando…' : 'Generar liga de acceso'}
        </button>
      </form>

      {estado.error && <p className="mt-1 text-xs text-peligro">{estado.error}</p>}

      {estado.liga && (
        <div className="mt-2 rounded-marca border border-border bg-fondo p-2">
          <p className="text-xs text-muted">
            Vence en una hora y sirve una sola vez. Al generarla, la anterior dejó
            de funcionar.
          </p>
          <p className="mt-1 text-xs break-all text-ink">{estado.liga}</p>
          <div className="mt-2">
            <CopiarLiga liga={estado.liga} />
          </div>
        </div>
      )}
    </div>
  )
}
