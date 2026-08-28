import { createClient } from '@/lib/supabase/server'
import { exigirConsultorio } from '@/lib/consultorio'
import { Insights, type Metricas } from '@/components/insights'
import { PrimerosPasos, type Paso } from '@/components/primeros-pasos'
import {
  DeDondeLlegan,
  type PorOrigen,
  type Recomendante,
} from '@/components/de-donde-llegan'
import { ControlesPendientes, type Control } from '@/components/controles-pendientes'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { leerPeriodo } from '@/lib/periodo'
import { nombreDePila } from '@/lib/fechas'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inicio' }

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { profesional, esDueño } = await exigirConsultorio()
  const supabase = await createClient()
  const periodo = leerPeriodo(await searchParams, profesional.timezone)

  const [
    { data: metricas },
    { count: franjas },
    { count: miembros },
    { data: origenes },
    { data: recomiendan },
    { data: cobertura },
    { data: controles },
  ] = await Promise.all([
      supabase
        .rpc('metricas_consultorio', { p_desde: periodo.desde, p_hasta: periodo.hasta })
        .returns<Metricas[]>(),
      supabase.from('availability').select('id', { count: 'exact', head: true }),
      supabase.from('memberships').select('id', { count: 'exact', head: true }),
      // Agregados en la base: traer los pacientes para contarlos aquí crecía
      // con cada alta y no aportaba nada que SQL no supiera hacer mejor.
      supabase.rpc('origenes_consultorio').returns<PorOrigen[]>(),
      supabase.rpc('recomendantes_consultorio', { p_limite: 5 }).returns<Recomendante[]>(),
      supabase.rpc('cobertura_origen').returns<{ con_origen: number; total: number }[]>(),
      // Quince días de gracia: alguien a quien "le tocaba el martes" sigue
      // siendo una llamada que vale la pena hacer el jueves.
      supabase.rpc('controles_pendientes', { p_dias_de_gracia: 15 }).returns<Control[]>(),
    ])

  const m = metricas?.[0]

  const pasos: Paso[] = profesional.onboarding_hidden_at
    ? []
    : [
        {
          titulo: 'Publica tu horario',
          porque:
            'Sin él tu página no puede ofrecer ni un hueco: la liga se ve, pero no deja agendar.',
          href: '/admin/horario',
          accion: 'Definirlo',
          hecho: (franjas ?? 0) > 0,
        },
        {
          titulo: 'Completa tu página',
          porque: 'Es lo que ve alguien que no te conoce antes de decidir si agenda.',
          href: '/admin/perfil',
          accion: 'Completarla',
          hecho: Boolean(profesional.bio) && Boolean(profesional.specialty),
        },
        {
          titulo: 'Da de alta a tu primer paciente',
          porque: 'Puedes agendarle tú, sin esperar a que alguien use tu liga.',
          href: '/admin/pacientes/nuevo',
          accion: 'Agregarlo',
          hecho: (m?.pacientes ?? 0) > 0,
        },
        ...(esDueño
          ? [
              {
                titulo: 'Invita a tu asistente',
                porque:
                  'Podrá mover la agenda y contestar solicitudes, pero no verá el expediente.',
                href: '/admin/equipo',
                accion: 'Invitarla',
                hecho: (miembros ?? 0) > 1,
              },
            ]
          : []),
      ]

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Hola, {nombreDePila(profesional.name)}
        </h1>
        <p className="mt-1 text-sm text-muted">Cómo va tu consultorio.</p>
      </header>

      {pasos.length > 0 && <PrimerosPasos pasos={pasos} />}

      <FiltroPeriodo exportar="/admin/exportar" />

      {/* Antes de los números: esto son llamadas que se pueden hacer hoy. */}
      <ControlesPendientes controles={controles ?? []} doctor={profesional.name} />

      {m && <Insights m={m} periodo={periodo.etiqueta} />}

      {/* De dónde llegan cierra la pantalla: es la única que mira hacia
          afuera, y la que dice en qué vale la pena invertir. */}
      <DeDondeLlegan
        porOrigen={origenes ?? []}
        recomiendan={recomiendan ?? []}
        conOrigen={cobertura?.[0]?.con_origen ?? 0}
        total={cobertura?.[0]?.total ?? 0}
      />
    </>
  )
}
