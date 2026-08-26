# CitaPedia

Agenda para pediatras. Next.js (App Router) + TypeScript + Tailwind, Supabase
(Postgres, Auth, RLS, Edge Functions), Resend para email. Ver `README.md` para
el modelo de datos y el plan.

## Decisiones cerradas

- **Sin pagos ni anticipos** en este MVP. Solo agenda.
- El médico **aprueba manualmente** cada cita: `requested` → `confirmed` | `rejected`.
  No hay confirmación automática.
- Página pública por médico en `/{slug}`, personalizable (bio, foto, tema, info
  de consulta).
- Roles: el médico es `owner` y puede invitar a un `assistant`, que gestiona la
  agenda y acepta/rechaza citas, pero no borra la cuenta ni invita a otros.
- Paciente simple: sin distinción tutor/niño por ahora.
- **La disponibilidad se calcula** (horario recurrente − citas ocupadas −
  bloqueos). Nunca pre-generar slots vacíos en la base.
- Recordatorios configurables por médico. Email es el default; SMS (Twilio) queda
  para después.

## Convenciones

- SQL, nombres de tablas y columnas en inglés; comentarios, copy y UI en español.
- Toda migración va en `supabase/migrations/` con timestamp; nada de cambios
  manuales al esquema.
- Después de tocar el esquema o el seed, corre `npm run db:verify` — valida el SQL
  contra un Postgres real (PGlite) sin necesidad de Docker.
- Los tipos de `src/lib/database.types.ts` se mantienen a mano por ahora; con la
  base local levantada, `npm run db:types` los regenera.
- Clientes de Supabase: `src/lib/supabase/server.ts` en Server Components, Route
  Handlers y Server Actions; `client.ts` solo en componentes de cliente;
  `session.ts` lo usa `src/proxy.ts` para refrescar el token en cada request.
- Next 16 usa la convención `proxy.ts`, no `middleware.ts`.
- La key pública es `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato nuevo
  `sb_publishable_...`); `env.ts` acepta la anon key vieja como fallback.

## Marca

Del logo salen tres colores, definidos como variables en `globals.css`: el
turquesa (`--brand`) es la acción, el azul marino (`--ink`) es el texto y el
azul (`--acento`) es para enlaces. Todo lo demás es neutro a propósito — una
agenda médica se lee mucho rato y el color debe señalar, no decorar.
Tipografía: Plus Jakarta Sans. Tagline: "Cuidarlos es primero".

Usa las clases `.tarjeta`, `.campo`, `.boton`, `.boton-primario` y
`.boton-suave` en vez de repetir utilidades de Tailwind.

`src/components/marca.tsx` trae una reconstrucción en SVG del isotipo; cuando
esté el archivo oficial va a `public/` y se cambia ahí.

## Reglas del dominio que ya viven en la base

- Dos citas `confirmed` del mismo médico no pueden solaparse (restricción de
  exclusión). Varias `requested` sí pueden pedir el mismo hueco.
- Las transiciones de estado las valida un trigger, no la UI: cualquier camino
  de escritura queda sujeto a la misma máquina de estados.
- Las horas de `availability` son `time` sin zona: ya están en la hora del
  consultorio. Al formatearlas hay que pasar `timeZone: 'UTC'` o se corren.
- El público nunca escribe en `appointments`: reserva por `solicitar_cita`
  (SECURITY DEFINER), que es donde vive la validación de verdad. `src/lib/slots.ts`
  solo decide qué ofrecer en pantalla; si los dos difieren, manda la función.

## Fotos

Las fotos de perfil van a Supabase Storage, bucket `fotos-perfil`, en la ruta
`{professional_id}/perfil-{timestamp}.{ext}`. El bucket es público (la foto se
ve en la página del médico) pero escribir está restringido por políticas sobre
`storage.objects`: cada consultorio solo toca su carpeta. Límites de tamaño y
tipo están en el propio bucket, no solo en la app.

`subirFoto` borra el archivo anterior al reemplazarlo, y borra el nuevo si la
actualización del perfil falla — para no dejar huérfanos en ninguna dirección.
`photo_url` ya no se edita como texto: lo maneja solo esa acción.

## Bloqueos

Se crean desde `/admin/horario` en la hora local del consultorio y se guardan
como instantes UTC (`horaLocalAInstante`). Un bloqueo de día completo va de
medianoche a medianoche del día siguiente: el fin es exclusivo, y
`describirBloqueo` lo tiene en cuenta al mostrarlo.

Bloquear un rango donde ya hay citas `confirmed` se rechaza con el conteo, en
vez de dejar citas prometidas dentro de un bloqueo.

## Formularios

React 19 resetea los formularios después de cada acción. Donde perder lo
escrito sea molesto, los campos van controlados y se limpian solo al tener
éxito (`Formulario` acepta `onExito`).

## Responsive

Mobile-first: el layout base es de una columna y las variantes van en `sm:`.
Reglas que se rompieron una vez y no deben volver a romperse:

- Padding: `px-4` en móvil, `sm:px-6`. Nunca `px-6` a secas.
- Los `input[type=time]` y `[type=date]` necesitan el ancho completo de su
  columna: en Chrome renderizan "09:00 a. m." y con anchos fijos se cortan.
- Nada de `flex` con un hijo `shrink-0` junto a texto largo: en móvil se
  encima. Apilar y pasar a fila en `sm:`.
- `capitalize` sube todas las palabras ("31 De Agosto"). Para fechas en
  español va `first-letter:uppercase`.
- Las barras de pestañas que hacen scroll llevan `-mx-4 px-4` para que la
  última pestaña no quede cortada contra el padding del contenedor.

Verificación rápida de desborde, con el viewport en 375 px:
`document.documentElement.scrollWidth > clientWidth` debe ser `false` en todas
las rutas.

## Cobertura de la máquina de estados

Cada estado necesita un camino real en la UI, o es dato muerto. Estado actual:

| Estado | Cómo se alcanza |
| --- | --- |
| `requested` | reserva pública |
| `confirmed` | Aceptar, en Solicitudes |
| `rejected` | Rechazar, en Solicitudes |
| `expired` | Archivar vencidas, en Solicitudes (el cron lo automatizará) |
| `completed` | Se atendió, en Agenda → Por cerrar |
| `no_show` | No asistió, en Agenda → Por cerrar |
| `cancelled_by_professional` | Cancelar, en Agenda |
| `cancelled_by_patient` | **sin camino todavía** |
| `rescheduled` | **sin camino todavía** |

Regla de la agenda: una cita `confirmed` que ya terminó NO desaparece — cae en
"Por cerrar" hasta que el consultorio dice qué pasó. Y cerrar o marcar
inasistencia solo se ofrece cuando la cita ya ocurrió; antes, lo único honesto
es cancelar.

## Filtros y listas

Los filtros viven en la URL (`?q=&desde=&hasta=&estado=&pagina=`), nunca en
estado del cliente. Así una búsqueda se comparte tal cual, el botón atrás
funciona, y filtrar es trabajo de Postgres, no del navegador.

- `src/lib/filtros.ts` parsea los `searchParams` y los aplica a la consulta.
- `src/components/filtros.tsx` es la barra: escribe en la URL con
  `router.replace`, con 350 ms de espera en el campo de texto.
- La búsqueda mira nombre, teléfono y correo del paciente a la vez: quien
  busca no siempre recuerda cuál tiene a la mano.
- Filtrar por la tabla de pacientes exige `patients!inner(...)`; sin `!inner`
  PostgREST filtra el recurso incrustado pero no las filas padre. Se usa
  **solo** cuando hay búsqueda, porque si no excluiría citas sin paciente.
- Listas largas van paginadas (`POR_PAGINA`), con `count: 'exact'`.

## Calendario

Dos disposiciones sobre la misma consulta, no una rejilla que se encoge: una
semana de siete columnas es ilegible en 375 px. Escritorio pinta la semana
(`hidden md:block`), móvil pinta un día con tira de días arriba (`md:hidden`).

- `src/lib/calendario.ts` es solo geometría, sin JSX ni consultas: se puede
  razonar y probar aparte.
- Todo se calcula en minutos desde la medianoche **local** del día que se
  pinta; el ancla es `medianocheDe(fecha, zona)`, no `new Date(fecha)`.
- La ventana de horas no es 00:00–24:00: sale del horario publicado y se
  estira lo justo para que ningún evento quede fuera de cuadro.
- Los eventos encimados se reparten en carriles por racimos (dos solicitudes
  al mismo hueco tienen que verse las dos).
- El fondo de columna es "cerrado" y las bandas blancas son las horas de
  atención — al revés se pierde el contraste. Los bloqueos van con trama
  diagonal para no confundirse con el fuera de horario.
- La semana se navega por URL (`?semana=`), el día de móvil también (`?dia=`).

## Invitaciones

Quien recibe una invitación todavía no es miembro, así que RLS le impide ver
la fila o crearse la membresía. Las dos operaciones pasan por funciones
SECURITY DEFINER: `ver_invitacion` (devuelve solo el nombre del consultorio,
el correo y el estado — nunca el token ni datos del equipo) y
`aceptar_invitacion`.

La invitación queda **atada al correo**: aceptar exige que el usuario en sesión
tenga ese mismo correo. Reenviar la liga a un tercero no le da acceso al
expediente de un consultorio ajeno. Es la razón de que exista la validación,
no un detalle.

El token se genera con `randomBytes(32)`: la liga es la credencial.

`miembros_del_consultorio()` expone los correos de `auth.users`, pero solo de
los consultorios de los que quien pregunta ya es miembro.

## Redirecciones

`next` solo acepta rutas internas (`/…`, y nunca `//…`). Sin ese filtro, el
login y la confirmación de correo se vuelven un trampolín para mandar gente a
dominios de terceros.

## Navegación del admin

Seis secciones no caben en una barra de pestañas en 375 px, y una barra que
hace scroll esconde justo lo que el usuario busca.

- **Móvil**: hamburguesa que despliega todo — foto y nombre (que llevan al
  perfil), las secciones, y Salir separado abajo.
- **Escritorio**: pestañas, con la foto y el nombre a la derecha como acceso
  al perfil, y Salir como botón visible.

La foto y el nombre **no** abren un menú desplegable: son un enlace directo a
`/admin/perfil`, que es donde la gente ya busca sus datos. Salir no se esconde
detrás de un clic extra.

El menú se cierra al navegar (`useEffect` sobre `usePathname`) y con Escape.
