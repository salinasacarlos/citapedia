import { dominioPublico } from '@/lib/sitio'
import { CopiarLiga } from '@/components/copiar-liga'
import { exigirConsultorio } from '@/lib/consultorio'
import { guardarPerfil } from '@/lib/admin/actions'
import { EditorTexto } from '@/components/editor-texto'
import { ESPECIALIDADES } from '@/lib/especialidades'
import { Campo, Formulario } from '@/components/formulario'
import { CampoTelefono } from '@/components/campo-telefono'
import { FotoPerfil } from '@/components/foto-perfil'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi página' }

// Las zonas de México más el resto que suele hacer falta.
const ZONAS = [
  'America/Mexico_City',
  'America/Cancun',
  'America/Monterrey',
  'America/Chihuahua',
  'America/Hermosillo',
  'America/Mazatlan',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'Europe/Madrid',
]

export default async function PerfilPage() {
  const { profesional: p } = await exigirConsultorio()

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Mi página</h1>
        <p className="mt-1 text-sm text-muted">
          Esto es lo que ven tus pacientes antes de pedirte cita.
        </p>
      </header>

      <section className="tarjeta mb-4 p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-ink">Tu foto</h2>
        <FotoPerfil fotoActual={p.photo_url} nombre={p.name} />
      </section>

      <Formulario accion={guardarPerfil} enviar="Guardar cambios" className="tarjeta p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            name="name"
            label="Nombre"
            defaultValue={p.name}
            required
            ayuda="Como quieres que te vean tus pacientes."
          />
          <Campo
            name="specialty"
            label="Especialidad"
            defaultValue={p.specialty ?? ''}
            placeholder="Pediatría"
            list="especialidades"
            ayuda="Elige de la lista si está; si no, escríbela."
          />
          {/*
            Lista sugerida, no catálogo cerrado: el campo acepta lo que sea.
            Sirve para que quien encuentre la suya la escriba igual que los
            demás y después se puedan agrupar sin adivinar.
          */}
          <datalist id="especialidades">
            {ESPECIALIDADES.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>

          <div className="sm:col-span-2">
            <label htmlFor="slug" className="block text-sm font-medium text-ink">
              Liga de tu página
            </label>
            <div className="mt-1.5 flex items-center gap-1 rounded-[0.625rem] border border-border bg-surface px-3 focus-within:border-brand">
              <span className="text-sm text-muted">{dominioPublico()}/</span>
              <input
                id="slug"
                name="slug"
                defaultValue={p.slug}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs text-muted">
                Minúsculas, números y guiones. Si la cambias, la liga anterior deja de
                funcionar.
              </p>
              <a
                href={`https://${dominioPublico()}/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-acento hover:underline"
              >
                Verla
              </a>
              <CopiarLiga
                liga={`https://${dominioPublico()}/${p.slug}`}
                etiqueta="Copiar"
                compacto
              />
            </div>
          </div>

          <CampoTelefono
            name="phone"
            label="Teléfono"
            valorInicial={p.phone}
            ayuda="El que ven tus pacientes en tu página pública."
          />
          <Campo
            name="clinic_address"
            label="Dirección del consultorio"
            defaultValue={p.clinic_address ?? ''}
            required={false}
          />

          <div className="sm:col-span-2">
            <Campo name="bio" label="Sobre ti">
              <EditorTexto
                name="bio"
                defaultValue={p.bio ?? ''}
                placeholder="Formación, años de experiencia, qué atiendes…"
              />
            </Campo>
          </div>

          <div className="sm:col-span-2">
            <Campo
              name="consultation_info"
              label="Información de consulta"
              ayuda="Qué llevar, duración, estacionamiento, formas de pago."
            >
              <EditorTexto
                name="consultation_info"
                defaultValue={p.consultation_info ?? ''}
                placeholder="Qué llevar, duración, estacionamiento, formas de pago…"
              />
            </Campo>
          </div>

          <Campo
            name="slot_duration"
            label="Duración de cita (minutos)"
            type="number"
            min={5}
            max={240}
            step={5}
            defaultValue={p.slot_duration ?? 30}
            required
          />

          <Campo name="timezone" label="Zona horaria" ayuda="Define a qué hora son tus horarios.">
            <select
              id="timezone"
              name="timezone"
              defaultValue={p.timezone}
              className="campo mt-1.5"
            >
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z.split('/').pop()!.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Formulario>
    </>
  )
}
