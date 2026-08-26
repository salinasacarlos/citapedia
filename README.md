# CitaPedia

Agenda de citas para pediatras. Cada médico tiene una página pública en
`citapedia.com/{slug}` donde los pacientes ven su perfil y su agenda y **solicitan**
una cita; el médico (o su asistente) la aprueba o la rechaza. Sin pagos en este MVP.

**Stack:** Next.js (App Router) + TypeScript · Supabase (Postgres, Auth, RLS, Edge
Functions) · Tailwind · Resend para email.

## Arrancar

```bash
npm install
cp .env.example .env.local   # pega tu URL y tu publishable key
npm run dev
```

`http://localhost:3000` muestra el estado del entorno: si falta conectar Supabase
o aplicar la migración te lo dice, y si todo está en su sitio resume el consultorio
sembrado.

### Aplicar el esquema al proyecto de Supabase

Con el CLI (deja registrada la historia de migraciones, es el camino bueno):

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push       # aplica supabase/migrations/
```

Sin contraseña de base a la mano, el atajo es pegar el SQL en el editor del
dashboard (Supabase → SQL Editor). Para copiarlo todo de una:

```bash
cat supabase/migrations/*.sql supabase/seed.sql | pbcopy
```

### Verificar el SQL sin tocar la nube

```bash
npm run db:verify
```

Corre las migraciones y el seed contra un Postgres real en memoria (PGlite) y
comprueba las reglas del dominio: que dos solicitudes puedan competir por el mismo
hueco pero dos citas confirmadas no se solapen, que el slug público sea url-safe,
que borrar un profesional se lleve su agenda pero no a los pacientes.

## Producción

Ver [DEPLOY.md](DEPLOY.md): variables de entorno, URLs de redirección en
Supabase, el asunto del SMTP y la limpieza de datos de prueba.

## Scripts

| script | qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo |
| `npm run db:push` | aplica las migraciones al proyecto enlazado |
| `npm run db:reset` | migración + seed desde cero (Supabase local) |
| `npm run test` | todo lo de abajo |
| `npm run db:verify` | corre las migraciones en PGlite y valida dominio, RLS y reservas |
| `npm run test:slots` | prueba el cálculo de huecos y las zonas horarias |
| `npm run db:types` | regenera `src/lib/database.types.ts` desde el proyecto enlazado |
| `npm run typecheck` | `tsc --noEmit` |

## Modelo de datos

Ocho tablas en `supabase/migrations/`:

- `professionals` — el médico y su página pública (bio, foto, tema, `slug`, duración de cita, zona horaria).
- `memberships` — quién puede administrar ese consultorio: `owner` (el médico) o `assistant`.
- `invitations` — invitación por token para sumar un asistente.
- `availability` — horario semanal recurrente (`weekday` 0=domingo … 6=sábado).
- `time_blocks` — huecos tapados puntualmente (juntas, vacaciones), editables desde el admin.
- `patients` — paciente simple, sin distinción tutor/niño por ahora.
- `appointments` — la cita y su estado.
- `reminder_settings` — canal y horas de anticipación por médico.

**La disponibilidad se calcula, no se almacena:** los slots libres salen de
`availability` − citas ocupadas − `time_blocks`. No hay filas de slots vacíos.
El cálculo vive en `src/lib/slots.ts` (funciones puras, `npm run test:slots`) y
respeta la zona horaria del consultorio, incluido el horario de verano.

**Reservar no es escribir en la tabla.** El público no tiene permiso de insertar
citas: pide por la función `solicitar_cita`, que valida en un solo lugar que el
hueco exista, esté libre y siga en el futuro. Si la UI se equivoca o alguien
llama la API a mano, ahí se detiene.

### Estados de una cita

```
requested ──▶ confirmed ──▶ completed
    │              │
    │              ├──▶ cancelled_by_patient
    │              ├──▶ cancelled_by_professional
    │              ├──▶ rescheduled ──(rescheduled_to)──▶ nueva cita
    │              └──▶ no_show
    ├──▶ rejected
    └──▶ expired
```

Solo `confirmed` dispara recordatorios. `rescheduled` cierra la cita vieja y apunta
a la nueva con `rescheduled_to`.

Una restricción de exclusión en `appointments` impide que dos citas **confirmadas**
del mismo médico se solapen; varias `requested` sí pueden pedir el mismo horario,
porque el médico elige cuál aprueba.

## Datos de prueba

No hay datos demo en ningún entorno real: `supabase/fixtures/demo.sql` existe
solo como fixture de `npm run db:verify`, y `config.toml` tiene la siembra
automática apagada. Un consultorio nuevo arranca vacío, como debe ser.

## Plan

1. ✅ Scaffolding + primera migración.
2. ✅ Auth y RLS: al registrarse un médico se crea su `professional` + `membership` owner.
3. ✅ Admin: perfil con foto, horario, bloqueos, solicitudes, agenda (lista y calendario) e historial con filtros.
4. ✅ Página pública `/{slug}` con slots calculados y formulario de reserva.
5. ✅ Invitación de asistente: liga con token atada al correo, vigencia de 7 días.
6. Recordatorios por email (Resend) vía cron + Edge Function. SMS después.
