-- CitaPedia — esquema inicial (MVP agenda, sin pagos)
-- Tablas base: profesionales, equipo, disponibilidad, pacientes, citas, recordatorios.
-- RLS se activa en la migración siguiente (paso 2: auth + RLS).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------- enums

create type appointment_status as enum (
  'requested', 'confirmed', 'completed',
  'cancelled_by_patient', 'cancelled_by_professional',
  'rejected', 'rescheduled', 'no_show', 'expired'
);

create type member_role as enum ('owner', 'assistant');

-- ------------------------------------------------------- updated_at util

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------ profesional

create table professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  specialty text,
  phone text,
  clinic_address text,
  slug text unique not null,
  bio text,
  photo_url text,
  theme text default 'default',
  consultation_info text,
  slot_duration int default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint professionals_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint professionals_slot_duration_positive check (slot_duration > 0)
);

create trigger professionals_set_updated_at
  before update on professionals
  for each row execute function set_updated_at();

-- ------------------------------------------------------------- membresías

create table memberships (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role member_role not null default 'owner',
  created_at timestamptz default now(),
  unique (professional_id, user_id)
);

create index memberships_user_id_idx on memberships (user_id);

-- ------------------------------------------------------------ invitaciones

create table invitations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  email text not null,
  role member_role not null default 'assistant',
  token text unique not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  constraint invitations_status_valid
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index invitations_professional_id_idx on invitations (professional_id);

-- --------------------------------------------------- horario recurrente

-- La disponibilidad NO pre-genera slots: es el horario semanal del que se
-- restan citas ocupadas y bloqueos al calcular los huecos libres.
create table availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint availability_time_order check (end_time > start_time)
);

create index availability_professional_id_weekday_idx
  on availability (professional_id, weekday);

-- --------------------------------------------------------------- bloqueos

create table time_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  constraint time_blocks_time_order check (ends_at > starts_at)
);

create index time_blocks_professional_id_starts_at_idx
  on time_blocks (professional_id, starts_at);

-- -------------------------------------------------------------- pacientes

create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------ citas

create table appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'requested',
  rescheduled_to uuid references appointments(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);

create index appointments_professional_id_starts_at_idx
  on appointments (professional_id, starts_at);
create index appointments_status_idx on appointments (status);

-- Varias solicitudes pueden competir por el mismo hueco (el médico elige una),
-- pero dos citas CONFIRMADAS del mismo médico nunca pueden solaparse.
alter table appointments
  add constraint appointments_no_overlap_when_confirmed
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed');

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------- recordatorios

create table reminder_settings (
  professional_id uuid primary key references professionals(id) on delete cascade,
  channel text not null default 'email',
  hours_before int[] default '{24}',
  message_template text default 'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.',
  constraint reminder_settings_channel_valid check (channel in ('email', 'sms'))
);
