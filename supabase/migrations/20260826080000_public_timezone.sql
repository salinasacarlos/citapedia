-- Para pintar la agenda pública hay que saber en qué zona son esas horas.
-- No es dato sensible: va implícito en los horarios que el médico publica.
create or replace view public.public_professionals
with (security_invoker = false) as
  select id, name, slug, specialty, bio, photo_url, theme,
         consultation_info, clinic_address, phone, slot_duration, timezone
    from public.professionals;

grant select on public.public_professionals to anon, authenticated;
