# Poner CitaPedia en producción

Estado: el código está listo para desplegar. Lo que falta es configuración de
entorno, y una decisión sobre el correo.

## ¿Hace falta GitHub?

**No es obligatorio.** Vercel puede desplegar desde tu máquina con `vercel --prod`.

Pero sin GitHub pierdes lo que hace que un despliegue sea seguro: cada push a
una rama te da una *preview* con su propia URL para revisar antes de publicar,
puedes volver a una versión anterior con un clic, y queda historia de qué
cambió y cuándo. Con un solo desarrollador y una app que ya maneja datos de
pacientes, esto vale la media hora que cuesta.

Recomendación: GitHub privado + Vercel conectado a él.

## 1. Variables de entorno en Vercel

En el proyecto de Vercel → Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | la URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | **la URL de producción**, p. ej. `https://citapedia.com` |

`NEXT_PUBLIC_SITE_URL` no es decorativa: de ahí sale la liga de confirmación
que se manda por correo. Si queda en `localhost`, tus usuarios reciben un
correo con una liga que no lleva a ningún lado.

## 2. URLs de redirección en Supabase

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://tu-dominio.com`
- **Redirect URLs**: agrega `https://tu-dominio.com/**` y, si usas previews,
  `https://*-tu-cuenta.vercel.app/**`

Sin esto, Supabase rechaza la redirección después de confirmar el correo.

## 3. El correo — esto sí es un bloqueo

El SMTP que trae Supabase manda **2 correos por hora** y no está pensado para
producción; es solo para desarrollo. Con eso, el tercer médico que se registre
en una hora no recibe su correo de confirmación.

Antes de abrir a usuarios reales hay que conectar un SMTP propio en
Dashboard → Authentication → SMTP Settings. Con Resend (que ya vamos a usar
para los recordatorios) sirve la misma cuenta:

- Host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña: tu API key.
- Requiere verificar tu dominio en Resend.

**Estado actual: la confirmación por correo está APAGADA.** Se apagó con
`supabase config push` para poder registrar cuentas sin toparse con el límite.
Eso significa que hoy cualquiera puede registrarse con un correo que no es
suyo. Es aceptable mientras solo entras tú; hay que volver a encenderla —con
SMTP propio ya conectado— antes de abrir a médicos reales.

## 4. Cuentas y datos de prueba

La base tiene datos que se sembraron para probar las pantallas:

```bash
supabase db query --linked "delete from appointments; delete from patients; delete from time_blocks;"
```

Hay dos cuentas de prueba, ambas con `salinasacarlos1+…@gmail.com`:
`dr-ernesto-pena` (con datos) y `dra-lucia-ferrer` (vacía, del registro de
prueba). Puedes renombrar una desde *Mi página* y volverla tu cuenta real, o
borrarlas y registrarte de nuevo:

```bash
supabase db query --linked "delete from auth.users where email like 'salinasacarlos1+%';"
```

Borrar el usuario se lleva su consultorio en cascada.

## 5. Migraciones

Vercel **no** corre migraciones. Cada vez que se agregue una:

```bash
supabase db push
```

Conviene correrlo antes de desplegar el código que la necesita.

## Lo que ya está resuelto

- RLS activo en las ocho tablas; el público solo ve vistas curadas.
- Las fotos van a un bucket con políticas por consultorio.
- Las reglas del dominio (solapes, transiciones de estado) viven en Postgres,
  así que no dependen de que la app acierte.
- Los slugs reservados (`admin`, `login`, …) están bloqueados: si no, un médico
  podría quedarse con una liga que las rutas de la app pisan.
- `.env*` está en `.gitignore` — las llaves no viajan al repositorio.
