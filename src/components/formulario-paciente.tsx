'use client'

import { useActionState, useState } from 'react'
import {
  crearPaciente,
  guardarPaciente,
  type ResultadoPaciente,
} from '@/lib/pacientes/actions'
import type { Patient } from '@/lib/database.types'

const PARENTESCOS = ['Madre', 'Padre', 'Tutor', 'Hijo', 'Hija', 'Cónyuge', 'Cuidador']

function Campo({
  name,
  label,
  ayuda,
  children,
  ...props
}: {
  name: string
  label: string
  ayuda?: string
  children?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children ?? <input id={name} name={name} className="campo mt-1.5" {...props} />}
      {ayuda && <p className="mt-1 text-xs text-muted">{ayuda}</p>}
    </div>
  )
}

export function FormularioPaciente({ paciente }: { paciente?: Patient }) {
  const esNuevo = !paciente
  const [estado, formAction, pendiente] = useActionState<ResultadoPaciente, FormData>(
    esNuevo ? crearPaciente : guardarPaciente,
    {},
  )
  // Quién es el paciente manda el resto del formulario, así que se pregunta
  // primero y en voz alta.
  const [dependiente, setDependiente] = useState(paciente?.is_minor ?? false)

  return (
    <form action={formAction} className="space-y-5">
      {paciente && <input type="hidden" name="id" value={paciente.id} />}

      <section className="tarjeta p-4 sm:p-6">
        <fieldset>
          <legend className="font-semibold text-ink">¿Quién es el paciente?</legend>
          <p className="mt-1 mb-3 text-sm text-muted">
            Define de quién son el teléfono y el correo, que es lo que más se
            confunde.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                valor: false,
                titulo: 'Se atiende solo',
                detalle: 'Un adulto que agenda para sí mismo',
              },
              {
                valor: true,
                titulo: 'Depende de alguien',
                detalle: 'Un menor, o alguien a cargo de un familiar',
              },
            ].map((opcion) => (
              <button
                key={String(opcion.valor)}
                type="button"
                aria-pressed={dependiente === opcion.valor}
                onClick={() => setDependiente(opcion.valor)}
                className={`rounded-marca border p-3 text-left transition ${
                  dependiente === opcion.valor
                    ? 'border-brand bg-brand-suave'
                    : 'border-border bg-surface hover:border-brand'
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    dependiente === opcion.valor ? 'text-brand' : 'text-ink'
                  }`}
                >
                  {opcion.titulo}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{opcion.detalle}</span>
              </button>
            ))}
          </div>
          <input
            type="checkbox"
            name="is_minor"
            checked={dependiente}
            onChange={() => {}}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </fieldset>
      </section>

      <section className="tarjeta p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink">Datos del paciente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo
              name="name"
              label="Nombre completo"
              required
              defaultValue={paciente?.name}
              ayuda="El de quien va a la consulta, no el de quien agenda."
            />
          </div>
          <Campo
            name="birth_date"
            label="Fecha de nacimiento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={paciente?.birth_date ?? ''}
            ayuda="De aquí sale la edad."
          />
          <Campo name="sex" label="Sexo">
            <select
              id="sex"
              name="sex"
              defaultValue={paciente?.sex ?? ''}
              className="campo mt-1.5"
            >
              <option value="">Sin especificar</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <Campo
            name="phone"
            label={dependiente ? 'Teléfono propio (si tiene)' : 'Teléfono'}
            type="tel"
            defaultValue={paciente?.phone ?? ''}
          />
          <Campo
            name="email"
            label={dependiente ? 'Correo propio (si tiene)' : 'Correo'}
            type="email"
            defaultValue={paciente?.email ?? ''}
          />
        </div>
      </section>

      {dependiente && (
        <section className="tarjeta p-4 sm:p-6">
          <h2 className="font-semibold text-ink">Quién responde por el paciente</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            A esta persona se le avisa de las citas.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              name="tutor_name"
              label="Nombre"
              required
              defaultValue={paciente?.tutor_name ?? ''}
            />
            <Campo name="tutor_relationship" label="Parentesco">
              <input
                id="tutor_relationship"
                name="tutor_relationship"
                list="parentescos-ficha"
                defaultValue={paciente?.tutor_relationship ?? ''}
                className="campo mt-1.5"
              />
              <datalist id="parentescos-ficha">
                {PARENTESCOS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Campo>
            <Campo
              name="tutor_phone"
              label="Teléfono"
              type="tel"
              defaultValue={paciente?.tutor_phone ?? ''}
            />
            <Campo
              name="tutor_email"
              label="Correo"
              type="email"
              defaultValue={paciente?.tutor_email ?? ''}
            />
          </div>
        </section>
      )}

      <section className="tarjeta p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink">En caso de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            name="emergency_contact_name"
            label="A quién llamar"
            defaultValue={paciente?.emergency_contact_name ?? ''}
          />
          <Campo
            name="emergency_contact_relationship"
            label="Parentesco"
            defaultValue={paciente?.emergency_contact_relationship ?? ''}
          />
          <Campo
            name="emergency_contact_phone"
            label="Teléfono"
            type="tel"
            defaultValue={paciente?.emergency_contact_phone ?? ''}
          />
        </div>
      </section>

      <section className="tarjeta p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink">Administrativo</h2>
        <div className="grid gap-4">
          <Campo
            name="insurance"
            label="Seguro o aseguradora"
            defaultValue={paciente?.insurance ?? ''}
          />
          <Campo name="notes" label="Notas de recepción">
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={paciente?.notes ?? ''}
              placeholder="Prefiere que le llamen por la tarde, viene con su abuela…"
              className="campo mt-1.5 resize-y"
            />
          </Campo>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendiente} className="boton boton-primario">
          {pendiente ? 'Guardando…' : esNuevo ? 'Crear paciente' : 'Guardar cambios'}
        </button>
        {estado.error && (
          <p role="alert" className="text-sm text-peligro">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="text-sm text-exito">
            {estado.ok}
          </p>
        )}
      </div>
    </form>
  )
}
