-- CitaPedia — administración de la plataforma.
--
-- Un rol que ve a través de todos los consultorios es lo más peligroso que
-- tiene este sistema, así que se construye con tres reglas:
--
-- 1. **No se toca el RLS de los consultorios.** Sería fácil agregarle
--    `or es_superadmin()` a cada política, y es justo como esto sale mal: se
--    ensancha en silencio cada permiso existente y ya nadie puede razonar qué
--    ve quién. El acceso va por funciones SECURITY DEFINER hechas para esto.
-- 2. **Nada clínico.** Ninguna función de aquí toca `clinical_records`,
--    `consultation_notes`, `consultation_files` ni `declared_records`. Operar
--    la plataforma no necesita leer el expediente de nadie, y lo que no se
--    expone no se filtra.
-- 3. **Todo queda anotado.** Suspender una cuenta es una acción con
--    consecuencias para un negocio ajeno: se guarda quién, qué y por qué.

create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz default now()
);

alter table public.platform_admins enable row level security;

-- Sin políticas a propósito: nadie lee ni escribe esta tabla por la API. El
-- primer admin se da de alta por SQL, y así nadie puede autonombrarse desde
-- la aplicación.
comment on table public.platform_admins is
  'Quién puede operar la plataforma. Se administra por SQL, nunca por la app.';

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = (select auth.uid())
  );
$$;

grant execute on function public.es_superadmin() to authenticated;

-- ------------------------------------------------------- cuenta suspendida

alter table public.professionals
  add column suspended_at     timestamptz,
  add column suspended_reason text;

comment on column public.professionals.suspended_at is
  'Cuenta desactivada por la plataforma. La agenda deja de recibir citas y la '
  'página pública deja de existir; los datos se quedan intactos.';

-- La suspensión tiene que apagar la página pública de verdad, no solo
-- esconder el botón: si la vista siguiera devolviendo al médico, cualquiera
-- con la liga podría seguir agendando.
create or replace view public.public_professionals
with (security_invoker = false) as
  select id, name, slug, specialty, bio, photo_url, theme,
         consultation_info, clinic_address, phone, slot_duration, timezone
    from public.professionals
   where suspended_at is null;

create table public.platform_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_id   uuid,
  detail      text,
  created_at  timestamptz default now()
);

alter table public.platform_audit enable row level security;

comment on table public.platform_audit is
  'Qué hizo la plataforma sobre cuentas ajenas. Solo se escribe desde las '
  'funciones de plataforma; no se edita ni se borra.';

create index platform_audit_reciente_idx on public.platform_audit (created_at desc);
