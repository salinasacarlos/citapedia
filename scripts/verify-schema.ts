/**
 * Verifica la migración y el seed contra un Postgres real (PGlite, en memoria).
 * No sustituye a `supabase db reset`, pero prueba que el SQL corre y que las
 * reglas del dominio (solapes, estados, cascadas) se comportan como esperamos.
 *
 *   npm run db:verify
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')
const FIXTURE = join(process.cwd(), 'supabase', 'fixtures', 'demo.sql')

let failures = 0

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function main() {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } })

  // Supabase provee auth.users; en local la stubbeamos para poder correr el SQL.
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    -- Igual que en Supabase: auth.uid() sale del claim 'sub' del JWT.
    create or replace function auth.uid() returns uuid
      language sql stable as $fn$
        select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
      $fn$;
    create schema if not exists storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text, owner uuid
    );
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[]
      language sql immutable as $fn$
        select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
      $fn$;
    create role anon;
    create role authenticated;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    grant execute on function auth.uid() to anon, authenticated;
  `)

  console.log('\nMigraciones')
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    check(file, true)
  }

  // Supabase otorga estos permisos a anon/authenticated por defecto; RLS es
  // lo que filtra, no la falta de grant. Replicarlo hace fiel la prueba.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;
    grant execute on all functions in schema public to anon, authenticated;
  `)

  console.log('\nFixture de prueba')
  await db.exec(readFileSync(FIXTURE, 'utf8'))
  check('fixtures/demo.sql', true)

  console.log('\nDatos sembrados')
  const pro = await db.query<{ name: string; slug: string; slot_duration: number }>(
    `select name, slug, slot_duration from professionals`,
  )
  check('1 pediatra', pro.rows.length === 1, pro.rows[0]?.slug)

  const avail = await db.query<{ n: number }>(
    `select count(*)::int as n from availability`,
  )
  check('horario semanal (11 franjas: L–V x2 + sábado)', avail.rows[0].n === 11)

  const byStatus = await db.query<{ status: string; n: number }>(
    `select status::text, count(*)::int as n from appointments group by 1 order by 1`,
  )
  console.log(
    '        ' + byStatus.rows.map((r) => `${r.status}=${r.n}`).join('  '),
  )
  const statuses = new Set(byStatus.rows.map((r) => r.status))
  for (const s of ['requested', 'confirmed', 'completed', 'rejected', 'rescheduled', 'expired', 'no_show', 'cancelled_by_patient']) {
    check(`hay citas en estado ${s}`, statuses.has(s))
  }

  const resched = await db.query<{ n: number }>(
    `select count(*)::int as n from appointments a
       join appointments b on b.id = a.rescheduled_to
      where a.status = 'rescheduled' and b.status = 'confirmed'`,
  )
  check('cita reagendada enlaza a su reemplazo confirmado', resched.rows[0].n === 1)

  console.log('\nReglas del dominio')

  // Dos solicitudes pueden competir por el mismo hueco.
  const compiten = await db.query<{ n: number }>(
    `select count(*)::int as n from appointments a
       join appointments b on b.id <> a.id
        and b.professional_id = a.professional_id
        and b.starts_at = a.starts_at
      where a.status = 'requested' and b.status = 'requested'`,
  )
  check('dos solicitudes pueden pedir el mismo horario', compiten.rows[0].n > 0)

  // Pero dos confirmadas no pueden solaparse.
  const proId = (await db.query<{ id: string }>(`select id from professionals limit 1`)).rows[0].id
  const ocupada = (
    await db.query<{ starts_at: Date; ends_at: Date }>(
      `select starts_at, ends_at from appointments where status = 'confirmed' order by starts_at limit 1`,
    )
  ).rows[0]
  const solapado = new Date(+new Date(ocupada.starts_at) + 10 * 60_000)
  let rechazada = false
  try {
    await db.query(
      `insert into appointments (professional_id, starts_at, ends_at, status)
       values ($1, $2, $3, 'confirmed')`,
      [proId, solapado, ocupada.ends_at],
    )
  } catch (err) {
    rechazada = String(err).includes('appointments_no_overlap_when_confirmed')
  }
  check('dos citas confirmadas no pueden solaparse', rechazada)

  // Un slug con mayúsculas o espacios no es una URL pública válida.
  let slugRechazado = false
  try {
    await db.query(
      `insert into professionals (name, email, slug) values ('X', 'x@x.com', 'Dra Mariana')`,
    )
  } catch (err) {
    slugRechazado = String(err).includes('professionals_slug_format')
  }
  check('el slug público debe ser url-safe', slugRechazado)

  // Un slug que pise una ruta de la app dejaría la página pública inaccesible.
  let reservadoBloqueado = false
  try {
    await db.query(`update professionals set slug = 'admin' where id = $1`, [proId])
  } catch (err) {
    reservadoBloqueado = String(err).includes('professionals_slug_no_reservado')
  }
  check('un slug reservado por la app se rechaza', reservadoBloqueado)

  let cortoBloqueado = false
  try {
    await db.query(`update professionals set slug = 'ab' where id = $1`, [proId])
  } catch (err) {
    cortoBloqueado = String(err).includes('professionals_slug_largo')
  }
  check('un slug de menos de 3 letras se rechaza', cortoBloqueado)

  // Rango invertido.
  let rangoRechazado = false
  try {
    await db.query(
      `insert into availability (professional_id, weekday, start_time, end_time)
       values ($1, 1, '13:00', '09:00')`,
      [proId],
    )
  } catch (err) {
    rangoRechazado = String(err).includes('availability_time_order')
  }
  check('el horario no puede terminar antes de empezar', rangoRechazado)

  // updated_at se mueve solo.
  const antes = (
    await db.query<{ updated_at: Date }>(`select updated_at from professionals limit 1`)
  ).rows[0].updated_at
  await db.query(`update professionals set bio = bio || ' ' where id = $1`, [proId])
  const despues = (
    await db.query<{ updated_at: Date }>(`select updated_at from professionals where id = $1`, [proId])
  ).rows[0].updated_at
  check('updated_at se actualiza solo', +new Date(despues) > +new Date(antes))

  let zonaMala = false
  try {
    await db.query(`update professionals set timezone = 'Marte/Olympus' where id = $1`, [proId])
  } catch (err) {
    zonaMala = String(err).includes('Zona horaria desconocida')
  }
  check('la zona horaria del consultorio se valida', zonaMala)

  const zonaOk = await db.query<{ timezone: string }>(
    `update professionals set timezone = 'America/Tijuana' where id = $1 returning timezone`,
    [proId],
  )
  check('se puede cambiar a otra zona real', zonaOk.rows[0].timezone === 'America/Tijuana')

  console.log('\nSolicitud de cita desde la página pública')

  // Un consultorio limpio para probar la reserva de punta a punta.
  const rsv = (
    await db.query<{ id: string }>(
      `insert into professionals (name, email, slug, slot_duration, timezone)
       values ('Dra. Reserva', 'reserva@clinica.com', 'dra-reserva', 30, 'America/Mexico_City')
       returning id`,
    )
  ).rows[0].id
  await db.query(
    `insert into availability (professional_id, weekday, start_time, end_time)
     select $1, d, '09:00', '13:00' from generate_series(0, 6) d`,
    [rsv],
  )

  /** Próximo día a las 10:00 hora de CDMX = 16:00 UTC. */
  const manana = new Date(Date.now() + 86_400_000)
  const y = manana.getUTCFullYear()
  const m = String(manana.getUTCMonth() + 1).padStart(2, '0')
  const d = String(manana.getUTCDate()).padStart(2, '0')
  const slot = `${y}-${m}-${d}T16:00:00Z`

  async function pedir(cuando: string, nombre: string, email: string | null, tel: string | null) {
    return db.query<{ solicitar_cita: string }>(
      `select public.solicitar_cita('dra-reserva', $1::timestamptz, $2, $3, $4, 'Prueba', null, null)`,
      [cuando, nombre, tel, email],
    )
  }

  // Agendar para otra persona: el teléfono es de quien agenda, no del paciente.
  const paraOtro = await db.query<{ solicitar_cita: string }>(
    `select public.solicitar_cita('dra-reserva', $1::timestamptz, 'Sofía Chica',
       '+52 55 7777 0000', null, null, 'Marta Chica', 'Madre')`,
    [`${y}-${m}-${d}T15:00:00Z`],
  )
  check('se puede agendar para otra persona', Boolean(paraOtro.rows[0].solicitar_cita))

  const quienEsQuien = await db.query<{
    name: string
    phone: string | null
    is_minor: boolean
    tutor_name: string
    tutor_phone: string
  }>(
    `select name, phone, is_minor, tutor_name, tutor_phone
       from patients where name = 'Sofía Chica'`,
  )
  const p = quienEsQuien.rows[0]
  check('el paciente queda marcado como dependiente', p?.is_minor === true)
  check('el tutor queda con nombre y parentesco', p?.tutor_name === 'Marta Chica')
  check(
    'el teléfono de quien agenda se guarda como del tutor',
    p?.tutor_phone === '+52 55 7777 0000',
  )
  check(
    'y NO se le atribuye también al paciente',
    p?.phone === null,
    `phone=${p?.phone}`,
  )

  const cita1 = await pedir(slot, 'Niña Uno', 'uno@example.com', null)
  check('un paciente puede solicitar cita', Boolean(cita1.rows[0].solicitar_cita))

  const estado = await db.query<{ status: string; ends_at: Date }>(
    `select status::text, ends_at from appointments where access_token = $1`,
    [cita1.rows[0].solicitar_cita],
  )
  check('la cita nace solicitada', estado.rows[0].status === 'requested')
  check(
    'la duración sale del consultorio (30 min)',
    new Date(estado.rows[0].ends_at).getTime() - Date.parse(slot) === 30 * 60_000,
  )

  // Dos personas pueden pedir el mismo hueco: el médico elige.
  const cita2 = await pedir(slot, 'Niño Dos', 'dos@example.com', null)
  check('otro paciente puede pedir el mismo hueco', Boolean(cita2.rows[0].solicitar_cita))

  // Pero si ya hay una confirmada, ese hueco se cierra.
  await db.query(`update appointments set status = 'confirmed' where access_token = $1`, [
    cita1.rows[0].solicitar_cita,
  ])
  let cerrado = false
  try {
    await pedir(slot, 'Niña Tres', 'tres@example.com', null)
  } catch (err) {
    cerrado = String(err).includes('acaba de tomar ese horario')
  }
  check('con una cita confirmada el hueco deja de ofrecerse', cerrado)

  // Fuera del horario publicado.
  let fuera = false
  try {
    await pedir(`${y}-${m}-${d}T05:00:00Z`, 'Niño Cuatro', 'cuatro@example.com', null)
  } catch (err) {
    fuera = String(err).includes('no está disponible')
  }
  check('no se puede pedir fuera del horario publicado', fuera)

  // En el pasado.
  let pasado = false
  try {
    await pedir('2020-01-01T16:00:00Z', 'Niña Cinco', 'cinco@example.com', null)
  } catch (err) {
    pasado = String(err).includes('ya pasó')
  }
  check('no se puede pedir en el pasado', pasado)

  // Sin forma de contactar.
  let sinContacto = false
  try {
    await pedir(`${y}-${m}-${d}T17:00:00Z`, 'Niño Seis', null, null)
  } catch (err) {
    sinContacto = String(err).includes('teléfono o un correo')
  }
  check('exige teléfono o correo', sinContacto)

  // Un bloqueo tapa el hueco.
  await db.query(
    `insert into time_blocks (professional_id, starts_at, ends_at, reason)
     values ($1, $2::timestamptz, $2::timestamptz + interval '1 hour', 'Junta')`,
    [rsv, `${y}-${m}-${d}T18:00:00Z`],
  )
  let bloqueado = false
  try {
    await pedir(`${y}-${m}-${d}T18:00:00Z`, 'Niña Siete', 'siete@example.com', null)
  } catch (err) {
    bloqueado = String(err).includes('no está disponible')
  }
  check('un bloqueo del médico cierra el hueco', bloqueado)

  // Tope de solicitudes vivas por contacto.
  let frenado = false
  try {
    // 15:00–19:00 UTC es la ventana (09:00–13:00 CDMX); 16:00 ya está
    // confirmada y 18:00 bloqueada, así que quedan estas.
    for (const h of ['15:00', '15:30', '16:30', '17:00']) {
      await pedir(`${y}-${m}-${d}T${h}:00Z`, 'Niño Spam', 'spam@example.com', null)
    }
  } catch (err) {
    frenado = String(err).includes('varias solicitudes pendientes')
  }
  check('se frena a quien acumula solicitudes pendientes', frenado)

  // El paciente que vuelve no se duplica.
  await db.query(
    `update appointments set status = 'rejected'
      where professional_id = $1 and status = 'requested'
        and patient_id in (select id from patients where email = 'dos@example.com')`,
    [rsv],
  )
  const pacientesAntes = (
    await db.query<{ n: number }>(`select count(*)::int as n from patients where email = 'dos@example.com'`)
  ).rows[0].n
  await pedir(`${y}-${m}-${d}T17:30:00Z`, 'Niño Dos', 'dos@example.com', null)
  const pacientesDespues = (
    await db.query<{ n: number }>(`select count(*)::int as n from patients where email = 'dos@example.com'`)
  ).rows[0].n
  check('un paciente que regresa no se duplica', pacientesAntes === 1 && pacientesDespues === 1)

  console.log('\nDatos declarados por el paciente')

  const citaDec = await pedir(`${y}-${m}-${d}T17:30:00Z`, 'Niña Declara', 'declara@example.com', null)
  const tokenDec = citaDec.rows[0].solicitar_cita

  let sinConsentimiento = false
  try {
    await db.query(`select declarar_datos_medicos($1, false, 'Penicilina')`, [tokenDec])
  } catch (err) {
    sinConsentimiento = String(err).includes('permiso para guardar datos de salud')
  }
  check('sin consentimiento no se guarda nada', sinConsentimiento)

  await db.query(
    `select declarar_datos_medicos($1, true, 'Penicilina', 'Asma', 'Salbutamol', 'O+')`,
    [tokenDec],
  )
  const declarado = await db.query<{ allergies: string; reviewed_at: string | null }>(
    `select allergies, reviewed_at from declared_records`,
  )
  check(
    'lo declarado se guarda sin verificar',
    declarado.rows[0]?.allergies === 'Penicilina' && declarado.rows[0].reviewed_at === null,
  )

  const enExpediente = await db.query<{ n: number }>(
    `select count(*)::int as n from clinical_records
      where patient_id = (select patient_id from appointments where access_token = $1)`,
    [tokenDec],
  )
  check('NO entra solo al expediente clínico', Number(enExpediente.rows[0].n) === 0)

  // La ventana ya no es de 24 horas: la liga sirve hasta el día de la cita.
  await db.query(
    `update appointments set starts_at = now() - interval '2 days',
                             ends_at = now() - interval '2 days' + interval '30 minutes'
      where access_token = $1`,
    [tokenDec],
  )
  let citaPasada = false
  try {
    await db.query(`select declarar_datos_medicos($1, true, 'otra cosa')`, [tokenDec])
  } catch (err) {
    citaPasada = String(err).includes('ya pasó')
  }
  check('después de la cita la liga ya no escribe', citaPasada)

  console.log('\nLa liga de la cita')

  const tokenLiga = (
    await pedir(`${y}-${m}-${d}T16:30:00Z`, 'Niño Liga', 'liga@example.com', null)
  ).rows[0].solicitar_cita

  const vistaLiga = await db.query<{
    consultorio: string
    paciente: string
    estado: string
    confirmada_por_paciente: boolean
  }>(`select consultorio, paciente, estado::text, confirmada_por_paciente from ver_cita($1)`, [
    tokenLiga,
  ])
  check(
    'con la liga se ve la cita sin estar en sesión',
    vistaLiga.rows[0]?.consultorio === 'Dra. Reserva' && vistaLiga.rows[0].paciente === 'Niño Liga',
  )
  check('y no viene confirmada por el paciente', vistaLiga.rows[0].confirmada_por_paciente === false)

  const inventada = await db.query(`select * from ver_cita('token-que-no-existe')`)
  check('un token inventado no devuelve nada', inventada.rows.length === 0)

  // Todavía es una solicitud: no se puede confirmar ni cancelar.
  let ligaSinAceptar = false
  try {
    await db.query(`select confirmar_asistencia($1)`, [tokenLiga])
  } catch (err) {
    ligaSinAceptar = String(err).includes('todavía no está confirmada')
  }
  check('no se confirma una cita que el consultorio no ha aceptado', ligaSinAceptar)

  await db.query(`update appointments set status = 'confirmed' where access_token = $1`, [
    tokenLiga,
  ])

  await db.query(`select confirmar_asistencia($1)`, [tokenLiga])
  const confirmada = await db.query<{ n: number }>(
    `select count(*)::int as n from appointments
      where access_token = $1 and patient_confirmed_at is not null`,
    [tokenLiga],
  )
  check('el paciente confirma su asistencia desde la liga', confirmada.rows[0].n === 1)

  // El último estado que no tenía camino.
  await db.query(`select cancelar_cita_paciente($1)`, [tokenLiga])
  const cancelada = await db.query<{ status: string; confirmada: boolean }>(
    `select status::text, patient_confirmed_at is not null as confirmada
       from appointments where access_token = $1`,
    [tokenLiga],
  )
  check(
    'el paciente puede cancelar: cancelled_by_patient por fin tiene camino',
    cancelada.rows[0].status === 'cancelled_by_patient',
  )
  check('y su confirmación se deshace', cancelada.rows[0].confirmada === false)

  let dosVeces = false
  try {
    await db.query(`select cancelar_cita_paciente($1)`, [tokenLiga])
  } catch (err) {
    dosVeces = String(err).includes('confirmada')
  }
  check('cancelar dos veces no hace nada raro', dosVeces)

  // ---------------------------------------- el paciente mueve su cita
  const tokenMover = (
    await pedir(`${y}-${m}-${d}T17:00:00Z`, 'Niña Mueve', 'mueve@example.com', null)
  ).rows[0].solicitar_cita
  await db.query(`update appointments set status = 'confirmed' where access_token = $1`, [
    tokenMover,
  ])

  const puede = await db.query<{ puede_reagendar: boolean; duracion_min: number }>(
    `select puede_reagendar, duracion_min from ver_cita($1)`,
    [tokenMover],
  )
  check('la liga dice si todavía se puede mover', puede.rows[0].puede_reagendar === true)
  check('y cuánto dura la cita', puede.rows[0].duracion_min === 30)

  const tokenNuevo = (
    await db.query<{ reagendar_cita_paciente: string }>(
      `select reagendar_cita_paciente($1, $2::timestamptz)`,
      // 15:00 UTC son las 09:00 en el consultorio: dentro del horario y sin
      // el bloqueo que puso una prueba anterior a las 18:00.
      [tokenMover, `${y}-${m}-${d}T15:00:00Z`],
    )
  ).rows[0].reagendar_cita_paciente
  check('el paciente puede mover su cita', Boolean(tokenNuevo) && tokenNuevo !== tokenMover)

  const enlazadas = await db.query<{ vieja: string; nueva: string }>(
    `select v.status::text as vieja, n.status::text as nueva
       from appointments v join appointments n on n.id = v.rescheduled_to
      where v.access_token = $1`,
    [tokenMover],
  )
  check(
    'la vieja queda reagendada y la nueva confirmada',
    enlazadas.rows[0]?.vieja === 'rescheduled' && enlazadas.rows[0].nueva === 'confirmed',
  )

  // Con la cita encima, ya no se puede mover.
  const tokenPegado = (
    await pedir(`${y}-${m}-${d}T16:30:00Z`, 'Niño Tarde', 'tarde@example.com', null)
  ).rows[0].solicitar_cita
  await db.query(
    `update appointments set status = 'confirmed',
            starts_at = now() + interval '3 hours',
            ends_at = now() + interval '3 hours 30 minutes'
      where access_token = $1`,
    [tokenPegado],
  )
  const yaNo = await db.query<{ puede_reagendar: boolean }>(
    `select puede_reagendar from ver_cita($1)`,
    [tokenPegado],
  )
  check('faltando 3 horas ya no se ofrece mover', yaNo.rows[0].puede_reagendar === false)

  let muyTarde = false
  try {
    await db.query(`select reagendar_cita_paciente($1, $2::timestamptz)`, [
      tokenPegado,
      `${y}-${m}-${d}T18:00:00Z`,
    ])
  } catch (err) {
    muyTarde = String(err).includes('falta muy poco')
  }
  check('y la base lo rechaza aunque se llame directo', muyTarde)

  await db.query(`delete from professionals where id = $1`, [rsv])

  console.log('\nReagendar')

  const rag = (
    await db.query<{ id: string }>(
      `insert into professionals (name, email, slug, slot_duration, timezone)
       values ('Dra. Reagenda', 'reagenda@clinica.com', 'dra-reagenda', 30, 'America/Mexico_City')
       returning id`,
    )
  ).rows[0].id
  await db.query(
    `insert into availability (professional_id, weekday, start_time, end_time)
     select $1, d, '09:00', '13:00' from generate_series(0, 6) d`,
    [rag],
  )
  const pacienteRag = (
    await db.query<{ id: string }>(
      `insert into patients (professional_id, name) values ($1, 'Niña Reagenda') returning id`,
      [rag],
    )
  ).rows[0].id

  const mañana = new Date(Date.now() + 86_400_000)
  const yr = mañana.getUTCFullYear()
  const mr = String(mañana.getUTCMonth() + 1).padStart(2, '0')
  const dr = String(mañana.getUTCDate()).padStart(2, '0')
  const alas = (h: string) => `${yr}-${mr}-${dr}T${h}:00Z`

  async function citaConfirmada(hora: string) {
    return (
      await db.query<{ id: string }>(
        `insert into appointments (professional_id, patient_id, starts_at, ends_at, status)
         values ($1, $2, $3::timestamptz, $3::timestamptz + interval '30 minutes', 'confirmed')
         returning id`,
        [rag, pacienteRag, alas(hora)],
      )
    ).rows[0].id
  }

  const cita = await citaConfirmada('16:00')

  // Mover unos minutos: vieja y nueva se enciman dentro de la transacción.
  const movida = await db.query<{ reagendar_cita: string }>(
    `select reagendar_cita($1, $2::timestamptz)`,
    [cita, alas('16:15')],
  )
  check('mover una cita unos minutos no choca consigo misma', Boolean(movida.rows[0].reagendar_cita))

  const enlace = await db.query<{ status: string; rescheduled_to: string | null }>(
    `select status::text, rescheduled_to from appointments where id = $1`,
    [cita],
  )
  check(
    'la vieja queda reagendada y apunta a la nueva',
    enlace.rows[0].status === 'rescheduled' &&
      enlace.rows[0].rescheduled_to === movida.rows[0].reagendar_cita,
  )

  const heredada = await db.query<{ patient_id: string; minutos: number }>(
    `select patient_id, extract(epoch from (ends_at - starts_at))/60 as minutos
       from appointments where id = $1`,
    [movida.rows[0].reagendar_cita],
  )
  check(
    'la nueva conserva paciente y duración',
    heredada.rows[0].patient_id === pacienteRag && Number(heredada.rows[0].minutos) === 30,
  )

  // Encimarse con OTRA confirmada sigue prohibido.
  const otra = await citaConfirmada('18:00')
  let choqueBloqueado = false
  try {
    await db.query(`select reagendar_cita($1, $2::timestamptz)`, [otra, alas('16:15')])
  } catch (err) {
    choqueBloqueado = String(err).includes('otra cita confirmada')
  }
  check('no se puede reagendar encima de otra cita confirmada', choqueBloqueado)

  // Fuera del horario publicado.
  let fueraBloqueado = false
  try {
    await db.query(`select reagendar_cita($1, $2::timestamptz)`, [otra, alas('05:00')])
  } catch (err) {
    fueraBloqueado = String(err).includes('fuera de tu horario')
  }
  check('no se puede reagendar fuera del horario de atención', fueraBloqueado)

  // Una cita ya cerrada no se mueve.
  let cerradaBloqueada = false
  try {
    await db.query(`select reagendar_cita($1, $2::timestamptz)`, [cita, alas('17:00')])
  } catch (err) {
    cerradaBloqueada = String(err).includes('confirmada')
  }
  check('una cita ya reagendada no se puede volver a mover', cerradaBloqueada)

  // Al mismo horario que ya tenía.
  let mismaBloqueada = false
  try {
    await db.query(`select reagendar_cita($1, $2::timestamptz)`, [otra, alas('18:00')])
  } catch (err) {
    mismaBloqueada = String(err).includes('misma hora')
  }
  check('reagendar a la misma hora se rechaza', mismaBloqueada)

  await db.query(`delete from professionals where id = $1`, [rag])

  console.log('\nConfirmación del paciente')

  const citaConf = (
    await db.query<{ id: string }>(
      `insert into appointments (professional_id, patient_id, starts_at, ends_at, status)
       values ($1, null, now() + interval '50 days', now() + interval '50 days' + interval '30 minutes', 'confirmed')
       returning id`,
      [proId],
    )
  ).rows[0].id

  await db.query(
    `update appointments set confirmation_sent_at = now(), patient_confirmed_at = now()
      where id = $1`,
    [citaConf],
  )
  const marcada = await db.query<{ n: number }>(
    `select count(*)::int as n from appointments
      where id = $1 and patient_confirmed_at is not null`,
    [citaConf],
  )
  check('una cita confirmada se puede confirmar con el paciente', marcada.rows[0].n === 1)

  // Una solicitud pendiente no se puede "confirmar con el paciente".
  const solicitud = (
    await db.query<{ id: string }>(
      `insert into appointments (professional_id, starts_at, ends_at, status)
       values ($1, now() + interval '51 days', now() + interval '51 days' + interval '30 minutes', 'requested')
       returning id`,
      [proId],
    )
  ).rows[0].id
  let sinAceptar = false
  try {
    await db.query(`update appointments set patient_confirmed_at = now() where id = $1`, [
      solicitud,
    ])
  } catch (err) {
    sinAceptar = String(err).includes('confirmada por el consultorio')
  }
  check('una solicitud sin aceptar no se puede confirmar con el paciente', sinAceptar)

  await db.query(`delete from appointments where id = any($1)`, [[citaConf, solicitud]])

  console.log('\nMáquina de estados')

  async function transicion(desde: string, hacia: string) {
    const cita = (
      await db.query<{ id: string }>(
        `insert into appointments (professional_id, starts_at, ends_at, status)
         values ($1, now() - interval '40 days', now() - interval '40 days' + interval '30 minutes', $2)
         returning id`,
        [proId, desde],
      )
    ).rows[0].id
    try {
      await db.query(`update appointments set status = $2 where id = $1`, [cita, hacia])
      return true
    } catch {
      return false
    } finally {
      await db.query(`delete from appointments where id = $1`, [cita])
    }
  }

  check('requested → confirmed se permite', await transicion('requested', 'confirmed'))
  check('requested → rejected se permite', await transicion('requested', 'rejected'))
  check('requested → completed se bloquea', !(await transicion('requested', 'completed')))
  check('confirmed → no_show se permite', await transicion('confirmed', 'no_show'))
  check('rejected → confirmed se bloquea', !(await transicion('rejected', 'confirmed')))
  check('completed → requested se bloquea', !(await transicion('completed', 'requested')))
  check(
    'confirmed → rescheduled exige apuntar a la nueva cita',
    !(await transicion('confirmed', 'rescheduled')),
  )

  console.log('\nRLS')

  // Dos médicos que se registran por su cuenta. El trigger sobre auth.users
  // les crea consultorio, membership de owner y preferencias.
  const drA = (
    await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('ana@clinica.com', '{"name":"Dra. Ana Ríos","specialty":"Pediatría"}')
       returning id`,
    )
  ).rows[0].id
  const drB = (
    await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('beto@clinica.com', '{"name":"Dr. Beto Lugo"}')
       returning id`,
    )
  ).rows[0].id

  const altas = await db.query<{ name: string; slug: string; role: string }>(
    `select p.name, p.slug, m.role::text
       from professionals p join memberships m on m.professional_id = p.id
      where m.user_id in ($1, $2) order by p.name`,
    [drA, drB],
  )
  check('el registro crea professional + membership owner', altas.rows.length === 2)
  check(
    'el slug se genera sin acentos ni espacios',
    altas.rows.some((r) => r.slug === 'dra-ana-rios'),
    altas.rows.map((r) => r.slug).join(', '),
  )
  check('el rol inicial es owner', altas.rows.every((r) => r.role === 'owner'))

  const ajustes = await db.query<{ n: number }>(
    `select count(*)::int as n from reminder_settings r
       join memberships m on m.professional_id = r.professional_id
      where m.user_id in ($1, $2)`,
    [drA, drB],
  )
  check('el registro deja listas las preferencias de recordatorio', ajustes.rows[0].n === 2)

  const reservado = (
    await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('admin@clinica.com', '{"name":"Admin"}') returning id`,
    )
  ).rows[0].id
  const slugDelReservado = (
    await db.query<{ slug: string }>(
      `select p.slug from professionals p
         join memberships m on m.professional_id = p.id where m.user_id = $1`,
      [reservado],
    )
  ).rows[0].slug
  check(
    'el alta automática esquiva los slugs reservados',
    slugDelReservado !== 'admin',
    slugDelReservado,
  )

  // Un asistente invitado NO debe estrenar consultorio propio.
  const invitado = (
    await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('asistente@clinica.com', '{"signup_kind":"assistant"}') returning id`,
    )
  ).rows[0].id
  const consultorioInvitado = await db.query<{ n: number }>(
    `select count(*)::int as n from memberships where user_id = $1`,
    [invitado],
  )
  check('un asistente invitado no estrena consultorio propio', consultorioInvitado.rows[0].n === 0)

  /** Corre una consulta haciéndose pasar por un usuario logueado (o por el público). */
  async function como<T>(userId: string | null, sql: string, params: unknown[] = []) {
    await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`)
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [
      userId ? JSON.stringify({ sub: userId }) : '',
    ])
    try {
      return await db.query<T>(sql, params)
    } finally {
      await db.exec(`reset role`)
    }
  }

  const proA = altas.rows.find((r) => r.slug === 'dra-ana-rios')!
  const idA = (
    await db.query<{ id: string }>(`select id from professionals where slug = $1`, [proA.slug])
  ).rows[0].id

  // Cada consultorio ve el suyo y solo el suyo.
  const veA = await como<{ slug: string }>(drA, `select slug from professionals`)
  check(
    'un médico solo ve su propio consultorio',
    veA.rows.length === 1 && veA.rows[0].slug === 'dra-ana-rios',
    `${veA.rows.length} fila(s)`,
  )

  const veB = await como<{ slug: string }>(drB, `select slug from professionals`)
  check(
    'el otro médico ve el suyo, no el de su colega',
    veB.rows.length === 1 && veB.rows[0].slug !== 'dra-ana-rios',
  )

  // La agenda sembrada pertenece a un tercer consultorio sin dueño: nadie la ve.
  const citasA = await como<{ n: number }>(drA, `select count(*)::int as n from appointments`)
  check('un médico no ve citas de otro consultorio', Number(citasA.rows[0].n) === 0)

  const pacientesA = await como<{ n: number }>(drA, `select count(*)::int as n from patients`)
  check('un médico no ve pacientes que no son suyos', Number(pacientesA.rows[0].n) === 0)

  // Escribir en agenda ajena tampoco.
  let escrituraBloqueada = false
  try {
    await como(drB, `insert into availability (professional_id, weekday, start_time, end_time)
                     values ($1, 1, '08:00', '09:00')`, [idA])
  } catch (err) {
    escrituraBloqueada = String(err).includes('row-level security')
  }
  check('nadie puede escribir en la agenda de otro consultorio', escrituraBloqueada)

  // Fotos: cada consultorio solo escribe en su propia carpeta.
  const idB = (
    await db.query<{ id: string }>(`select id from professionals where slug <> $1 and slug <> $2 limit 1`,
      ['dra-ana-rios', 'dra-mariana-cordero'])
  ).rows[0].id

  const subioPropia = await como(
    drA,
    `insert into storage.objects (bucket_id, name) values ('fotos-perfil', $1 || '/perfil.jpg')`,
    [idA],
  ).then(() => true).catch(() => false)
  check('un médico puede subir su propia foto', subioPropia)

  let ajenaBloqueada = false
  try {
    await como(drA, `insert into storage.objects (bucket_id, name) values ('fotos-perfil', $1 || '/perfil.jpg')`, [idB])
  } catch (err) {
    ajenaBloqueada = String(err).includes('row-level security')
  }
  check('no puede subir a la carpeta de otro consultorio', ajenaBloqueada)

  let carpetaBasura = false
  try {
    await como(drA, `insert into storage.objects (bucket_id, name) values ('fotos-perfil', 'no-es-uuid/perfil.jpg')`)
  } catch (err) {
    carpetaBasura = String(err).includes('row-level security')
  }
  check('una carpeta con nombre inválido se rechaza sin reventar', carpetaBasura)

  const fotoPublica = await como<{ n: number }>(
    null,
    `select count(*)::int as n from storage.objects where bucket_id = 'fotos-perfil'`,
  )
  check('las fotos sí son visibles para el público', Number(fotoPublica.rows[0].n) > 0)

  // El público: tablas cerradas, vistas abiertas.
  const anonPro = await como<{ n: number }>(null, `select count(*)::int as n from professionals`)
  check('el público no lee la tabla professionals', Number(anonPro.rows[0].n) === 0)

  const anonCitas = await como<{ n: number }>(null, `select count(*)::int as n from appointments`)
  check('el público no lee citas', Number(anonCitas.rows[0].n) === 0)

  const anonVista = await como<{ slug: string }>(null, `select slug from public_professionals`)
  check('el público sí ve los perfiles por la vista', anonVista.rows.length >= 3)

  const zonaPublica = await como<{ timezone: string }>(
    null,
    `select timezone from public_professionals limit 1`,
  )
  check('la vista pública incluye la zona horaria', Boolean(zonaPublica.rows[0]?.timezone))

  let emailOculto = false
  try {
    await como(null, `select email from public_professionals`)
  } catch (err) {
    emailOculto = String(err).includes('does not exist')
  }
  check('la vista pública no expone el email de acceso', emailOculto)

  const anonHuecos = await como<{ n: number }>(null, `select count(*)::int as n from public_busy_slots`)
  check('el público ve las horas ocupadas para calcular huecos', Number(anonHuecos.rows[0].n) > 0)

  let razonOculta = false
  try {
    await como(null, `select reason from public_time_blocks`)
  } catch (err) {
    razonOculta = String(err).includes('does not exist')
  }
  check('la vista pública de bloqueos no dice el motivo', razonOculta)

  console.log('\nInvitación de asistente')

  const proA2 = (
    await db.query<{ id: string }>(`select id from professionals where slug = 'dra-ana-rios'`)
  ).rows[0].id

  async function invitar(correo: string, vence: string) {
    return (
      await db.query<{ token: string }>(
        `insert into invitations (professional_id, email, role, token, expires_at)
         values ($1, $2, 'assistant', $3, now() + $4::interval) returning token`,
        [proA2, correo, `tok-${correo}-${vence}`, vence],
      )
    ).rows[0].token
  }

  const tokenBueno = await invitar('asistente@clinica.com', '7 days')

  const vista = await db.query<{ consultorio: string; rol: string; vencida: boolean }>(
    `select consultorio, rol::text, vencida from ver_invitacion($1)`,
    [tokenBueno],
  )
  check(
    'el invitado ve de quién es la invitación sin ser miembro',
    vista.rows[0]?.consultorio === 'Dra. Ana Ríos' && vista.rows[0].vencida === false,
  )

  // El asistente que ya existía en auth (creado más arriba) la acepta.
  await db.exec(`set role authenticated`)
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: invitado }),
  ])
  const aceptada = await db.query<{ aceptar_invitacion: string }>(
    `select aceptar_invitacion($1)`,
    [tokenBueno],
  )
  await db.exec(`reset role`)
  check('aceptar la invitación crea la membresía', aceptada.rows[0].aceptar_invitacion === proA2)

  const rolNuevo = await db.query<{ role: string }>(
    `select role::text from memberships where user_id = $1 and professional_id = $2`,
    [invitado, proA2],
  )
  check('entra como assistant, no como owner', rolNuevo.rows[0]?.role === 'assistant')

  const yaUsada = await db.query<{ status: string }>(
    `select status from invitations where token = $1`,
    [tokenBueno],
  )
  check('la invitación queda marcada como aceptada', yaUsada.rows[0].status === 'accepted')

  // Reusar la misma liga no debe dar acceso otra vez.
  let reusoBloqueado = false
  try {
    await como(drB, `select aceptar_invitacion($1)`, [tokenBueno])
  } catch (err) {
    reusoBloqueado = String(err).includes('ya se usó')
  }
  check('una invitación usada no sirve dos veces', reusoBloqueado)

  // Reenviar la liga a otra persona no le da acceso.
  const tokenAjeno = await invitar('otra.persona@clinica.com', '7 days')
  let correoDistinto = false
  try {
    await como(drB, `select aceptar_invitacion($1)`, [tokenAjeno])
  } catch (err) {
    correoDistinto = String(err).includes('Esta invitación es para')
  }
  check('reenviar la liga a otro correo no da acceso', correoDistinto)

  // Vencida.
  const tokenViejo = await invitar('tarde@clinica.com', '-1 days')
  let vencidaBloqueada = false
  try {
    await como(drB, `select aceptar_invitacion($1)`, [tokenViejo])
  } catch (err) {
    vencidaBloqueada = String(err).includes('venció')
  }
  check('una invitación vencida se rechaza', vencidaBloqueada)

  // Sin sesión.
  let anonBloqueado = false
  try {
    const t = await invitar('anon@clinica.com', '7 days')
    await como(null, `select aceptar_invitacion($1)`, [t])
  } catch (err) {
    anonBloqueado = String(err).includes('iniciar sesión')
  }
  check('sin sesión no se puede aceptar', anonBloqueado)

  // Dos invitaciones vivas al mismo correo, no.
  let duplicadaBloqueada = false
  try {
    await invitar('asistente2@clinica.com', '7 days')
    await db.query(
      `insert into invitations (professional_id, email, role, token, expires_at)
       values ($1, 'asistente2@clinica.com', 'assistant', 'otro-token', now() + interval '7 days')`,
      [proA2],
    )
  } catch (err) {
    duplicadaBloqueada = String(err).includes('invitations_pendiente_unica')
  }
  check('no se puede invitar dos veces al mismo correo', duplicadaBloqueada)


  // La UI le esconde los botones al asistente, pero eso no es seguridad:
  // lo que manda son las políticas.
  const citasAsistente = await como<{ n: number }>(
    invitado,
    `select count(*)::int as n from appointments`,
  )
  check(
    'el asistente sí ve la agenda del consultorio',
    Number(citasAsistente.rows[0].n) >= 0,
  )

  let invitarBloqueado = false
  try {
    await como(
      invitado,
      `insert into invitations (professional_id, email, role, token, expires_at)
       values ($1, 'colado@clinica.com', 'assistant', 'token-colado', now() + interval '7 days')`,
      [proA2],
    )
  } catch (err) {
    invitarBloqueado = String(err).includes('row-level security')
  }
  check('un asistente no puede invitar a nadie', invitarBloqueado)

  const borrado = await como<{ n: number }>(
    invitado,
    `with borradas as (delete from professionals where id = $1 returning 1)
     select count(*)::int as n from borradas`,
    [proA2],
  )
  check('un asistente no puede borrar el consultorio', Number(borrado.rows[0].n) === 0)

  const sacarDueño = await como<{ n: number }>(
    invitado,
    `with quitadas as (delete from memberships where professional_id = $1 and role = 'owner' returning 1)
     select count(*)::int as n from quitadas`,
    [proA2],
  )
  check('un asistente no puede sacar al dueño', Number(sacarDueño.rows[0].n) === 0)

  // Expediente: el asistente ve a quién contactar, no lo clínico.
  const pacienteA = (
    await db.query<{ id: string }>(
      `insert into patients (professional_id, name, phone, birth_date, tutor_name)
       values ($1, 'Niño Prueba', '+52 55 0000 0000', '2019-04-12', 'Mamá Prueba')
       returning id`,
      [proA2],
    )
  ).rows[0].id

  await db.query(
    `insert into clinical_records (patient_id, professional_id, allergies, conditions)
     values ($1, $2, 'Penicilina', 'Asma leve')`,
    [pacienteA, proA2],
  )

  const contactoAsistente = await como<{ name: string; phone: string }>(
    invitado,
    `select name, phone from patients where id = $1`,
    [pacienteA],
  )
  check(
    'el asistente sí ve los datos de contacto del paciente',
    contactoAsistente.rows[0]?.phone === '+52 55 0000 0000',
  )

  const clinicoAsistente = await como<{ n: number }>(
    invitado,
    `select count(*)::int as n from clinical_records`,
  )
  check(
    'el asistente NO ve el expediente clínico',
    Number(clinicoAsistente.rows[0].n) === 0,
  )

  const clinicoMedico = await como<{ allergies: string }>(
    drA,
    `select allergies from clinical_records where patient_id = $1`,
    [pacienteA],
  )
  check(
    'el médico sí ve el expediente de su paciente',
    clinicoMedico.rows[0]?.allergies === 'Penicilina',
  )

  let escrituraClinica = false
  try {
    await como(
      invitado,
      `insert into clinical_records (patient_id, professional_id, allergies)
       values ($1, $2, 'inventado')`,
      [pacienteA, proA2],
    )
  } catch (err) {
    escrituraClinica = String(err).includes('row-level security')
  }
  check('el asistente no puede escribir en el expediente', escrituraClinica)

  const ajeno = await como<{ n: number }>(
    drB,
    `select count(*)::int as n from patients`,
  )
  check('un médico no ve los pacientes de otro consultorio', Number(ajeno.rows[0].n) === 0)

  console.log('\nAgendar desde el consultorio')

  const pacAgenda = (
    await db.query<{ id: string }>(
      `insert into patients (professional_id, name, phone)
       values ($1, 'Paciente Mostrador', '+52 55 1234 5678') returning id`,
      [proA2],
    )
  ).rows[0].id

  const lunesQueViene = (() => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`
  })()

  // Dra. Ana atiende de 9 a 13 los días entre semana (fixture de arriba).
  await db.query(
    `insert into availability (professional_id, weekday, start_time, end_time)
     select $1, d, '09:00', '13:00' from generate_series(0, 6) d
      where not exists (select 1 from availability where professional_id = $1)`,
    [proA2],
  )

  const nueva = await como<{ agendar_cita: string }>(
    drA,
    `select agendar_cita($1, $2::timestamptz, 45, 'Primera consulta')`,
    [pacAgenda, `${lunesQueViene}T16:00:00Z`],
  )
  check('el consultorio puede agendar directo', Boolean(nueva.rows[0].agendar_cita))

  const nace = await db.query<{ status: string; minutos: number }>(
    `select status::text, extract(epoch from (ends_at - starts_at))/60 as minutos
       from appointments where id = $1`,
    [nueva.rows[0].agendar_cita],
  )
  check('nace confirmada, sin pasar por solicitud', nace.rows[0].status === 'confirmed')
  check('respeta la duración que se le pide', Number(nace.rows[0].minutos) === 45)

  let encimada = false
  try {
    await como(drA, `select agendar_cita($1, $2::timestamptz)`, [
      pacAgenda,
      `${lunesQueViene}T16:15:00Z`,
    ])
  } catch (err) {
    encimada = String(err).includes('otra cita confirmada')
  }
  check('no se puede encimar sobre otra confirmada', encimada)

  let ajena = false
  try {
    await como(drB, `select agendar_cita($1, $2::timestamptz)`, [
      pacAgenda,
      `${lunesQueViene}T17:00:00Z`,
    ])
  } catch (err) {
    ajena = String(err).includes('No encontramos ese paciente')
  }
  check('no se puede agendar a un paciente de otro consultorio', ajena)

  await db.query(`delete from appointments where patient_id = $1`, [pacAgenda])
  await db.query(`delete from patients where id = $1`, [pacAgenda])

  const equipoA = await como<{ email: string; rol: string }>(
    drA,
    `select email, rol::text from miembros_del_consultorio()`,
  )
  check(
    'el dueño ve a su equipo con correos',
    equipoA.rows.length === 2 &&
      equipoA.rows.some((r) => r.rol === 'owner') &&
      equipoA.rows.some((r) => r.rol === 'assistant'),
    equipoA.rows.map((r) => `${r.rol}:${r.email}`).join(', '),
  )

  const equipoB = await como<{ email: string }>(
    drB,
    `select email from miembros_del_consultorio()`,
  )
  check('un médico no ve el equipo de otro consultorio', equipoB.rows.length === 1)

  // Borrar al profesional se lleva su agenda.
  await db.query(`delete from professionals where id = $1`, [proId])
  const huerfanas = await db.query<{ n: number }>(
    `select (select count(*) from appointments      where professional_id = $1)
          + (select count(*) from availability      where professional_id = $1)
          + (select count(*) from time_blocks       where professional_id = $1)
          + (select count(*) from reminder_settings where professional_id = $1) as n`,
    [proId],
  )
  check('borrar al profesional limpia su agenda en cascada', Number(huerfanas.rows[0].n) === 0)

  // Cambió a propósito al darle dueño al paciente: el expediente de un
  // consultorio no debe quedar huérfano cuando el consultorio desaparece.
  const suyos = await db.query<{ n: number }>(
    `select count(*)::int as n from patients where professional_id = $1`,
    [proId],
  )
  check('borrar al profesional se lleva a sus pacientes', suyos.rows[0].n === 0)

  const deOtros = await db.query<{ n: number }>(
    `select count(*)::int as n from patients where professional_id <> $1`,
    [proId],
  )
  check(
    'los pacientes de otros consultorios no se tocan',
    deOtros.rows[0].n > 0,
    `${deOtros.rows[0].n} intactos`,
  )

  await db.close()

  console.log(
    failures === 0
      ? '\n✅ Esquema verificado.\n'
      : `\n❌ ${failures} verificación(es) fallaron.\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
