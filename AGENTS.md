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

## Despliegue

Vercel construye por su cuenta cada push a cualquier rama como Preview, y
`main` como Production. Con el flujo de rama → PR → merge, eso son dos builds
por cambio: el Preview de la rama y el Production del merge, del mismo código.

`vercel.json` cancela los Preview. Dos trampas al tocarlo, las dos ya cobradas:

- En `ignoreCommand`, **salir con 0 cancela** el build y salir con 1 lo deja
  correr, al revés de lo que se espera de un código de salida.
- La condición pregunta si el entorno **es** preview, no si **no es**
  producción. Con la forma negada, un `VERCEL_ENV` vacío cancelaba producción
  y el sitio se quedó servido en el build anterior sin que nada marcara error.
  Así, lo peor que puede pasar es que se construya de más.

El día que la revisión de PRs pida ver la rama corriendo, se quita y se paga
el build de más — pero mientras la verificación sea en localhost, no compra
nada.

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
- El mismo componente en dos anchos distintos va con `@container`, no con
  `md:`: `SelectorHueco` vive en la página pública (ancha) y dentro de la
  tarjeta de la cita (448 px). La media query mira la ventana, no la tarjeta,
  y ahí las horas se encimaban.
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
| `cancelled_by_patient` | "No voy a poder asistir", en la liga de la cita |
| `rescheduled` | Reagendar, en Agenda (`reagendar_cita`) |

Regla de la agenda: una cita `confirmed` que ya terminó NO desaparece — cae en
"Por cerrar" hasta que el consultorio dice qué pasó. Y cerrar o marcar
inasistencia solo se ofrece cuando la cita ya ocurrió; antes, lo único honesto
es cancelar.

## El paciente mueve su propia cita

Desde la liga (`/cita/[token]`) el paciente no solo confirma o cancela: si algo
se le atravesó, puede mover la cita él mismo. Cancelar para volver a agendar
pierde el hueco y termina en inasistencia; moverla lo conserva.

- `reagendar_cita_paciente` es la única puerta, y no confía en la UI: revalida
  el token, el estado y la anticipación. `horas_minimas_para_reagendar()` es 12.
- La cita nueva nace **`confirmed`**, no `requested`: ya estaba aprobada, mover
  la hora no la vuelve a poner en la fila de espera.
- Conserva paciente y duración, igual que reagendar desde el consultorio.
- La liga vieja muere con la cita vieja; la respuesta redirige al token nuevo.
  Por eso el aviso de `rescheduled` no le atribuye el cambio a nadie: ahora
  puede haberlo hecho cualquiera de los dos lados.
- `ver_cita` devuelve `puede_reagendar` y `duracion_min` para que la página no
  tenga que recalcular la regla ni ofrecer huecos de la duración equivocada.

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

La foto y el nombre abren el menú de cuenta: Mi página pública, Mi cuenta y
Salir. En móvil todo eso vive dentro de la hamburguesa.

El menú se cierra al navegar (`useEffect` sobre `usePathname`) y con Escape.

## Cuenta

`/admin/cuenta` es datos de acceso; `/admin/perfil` es lo que ven los
pacientes. Son cosas distintas y conviene que sigan separadas.

Cambiar contraseña **exige la de ahora**, reautenticando con
`signInWithPassword`. Una sesión olvidada en la computadora del consultorio no
puede servir para cambiar la contraseña y dejar fuera al dueño.

Eliminar el consultorio pide escribir el slug. Un "¿estás seguro?" se acepta
por reflejo, y esto borra la agenda completa sin vuelta atrás. Borra el
`professional` (cascada), no el usuario de auth: esa cuenta queda viva y cae en
`/sin-acceso`.

Cambiar el correo de acceso está pendiente a propósito: exige confirmar el
nuevo por mensaje, y sin SMTP el médico se quedaría fuera de su propia cuenta.
Ojo además con que `professionals.email` y el correo de `auth.users` son campos
distintos: al habilitarlo hay que mover los dos.

## Agendar desde el consultorio

Hasta la migración `agendar_desde_admin`, toda cita nacía en la página
pública. La realidad es que la gente llama o escribe por WhatsApp, y la
recepcionista necesita agendar mientras tiene a la persona en la línea.

`agendar_cita` valida lo mismo que `solicitar_cita` pero crea la cita ya
`confirmed`: no tiene sentido que el consultorio se mande una solicitud a sí
mismo para después aceptarla. Va con SECURITY INVOKER, como `reagendar_cita`.

Acepta duración: una primera consulta no dura lo mismo que un seguimiento. Al
cambiarla, los huecos se recalculan —va por URL, así que lo hace el servidor.

Dar de alta al paciente y crear la cita son dos pasos separados a propósito: si
el hueco se ocupa mientras la recepcionista escribe, el paciente ya quedó
capturado y no hay que teclearlo otra vez.

## Reagendar

Mover una cita son dos escrituras que no pueden quedar a medias: si se crea la
nueva y falla el cierre de la vieja, el paciente termina con dos citas. Todo
vive en `reagendar_cita`, una sola transacción.

Va con **SECURITY INVOKER** a propósito, al revés que `solicitar_cita`: quien
reagenda ya es miembro, así que RLS decide qué citas puede tocar y no hace
falta elevarse.

La restricción de solape es **DEFERRABLE**: al mover una cita quince minutos,
la vieja y la nueva se enciman por un instante dentro de la transacción. Se
aplaza para que se revise al final, cuando la vieja ya dejó de estar
confirmada. Encimarse con **otra** cita confirmada sigue prohibido.

La cita conserva su duración y su paciente: reagendar es moverla, no
reconfigurarla.

`SelectorHueco` es el mismo componente que usa la página pública. Un solo
calendario que mantener, y el médico ve exactamente los huecos que verían sus
pacientes.

## Quién es el paciente

El enredo clásico: una mamá agenda, escribe el nombre del niño y su propio
teléfono, y el sistema guarda los dos en el mismo renglón sin saber cuál es
cuál. Por eso `solicitar_cita` **pregunta** en vez de adivinar, y
`patients.is_minor` guarda la respuesta.

No se deduce de la edad: la fecha de nacimiento puede faltar, y adivinar de
quién es el teléfono a partir de ella es justo el error que se quiere evitar.

Cuando `is_minor` es true, el teléfono de quien agendó se guarda en
`tutor_phone`, no en `phone`. La ficha lo dice con todas sus letras: "se le
avisa a…".

## Adultos y niños, no solo pediatría

El producto nació con copy de pediatra ("Agenda para pediatras", "los papás
ven sus horarios") y eso ya no es cierto: sirve para cualquier consultorio. Los
textos hablan de pacientes, y donde importa reconocen que a veces quien agenda
acompaña al paciente en vez de serlo — que es lo que `is_minor` modela.

La tagline "Cuidarlos es primero" se queda: es marca, no promesa de
especialidad. Los placeholders de especialidad ("Pediatría") también, porque
son ejemplos de qué escribir, no una afirmación.

## Pacientes y expediente

`patients` tiene dueño (`professional_id`) y las políticas se apoyan en eso,
no en rodear por la tabla de citas.

Lo clínico vive aparte porque **RLS filtra filas, no columnas**: no existe una
política que deje al asistente ver el teléfono pero no las alergias.
`clinical_records` y `consultation_notes` son de solo dueño.

En la ficha, la lista de visitas se llama **Bitácora del paciente**, no
"historial de citas": cada renglón junta la cita con lo que el médico anotó ese
día, así que es la línea de tiempo del paciente y no un registro de agenda. El
Historial del admin es otra cosa —las citas cerradas de todo el consultorio— y
por eso conserva su nombre.

`appointments.notes` es lo que escribió el paciente al pedir cita.
`consultation_notes.note` es lo que encontró el médico. Son cosas distintas y
la ficha las muestra por separado.

`patients_resumen` es una vista con `security_invoker = true` —al revés que
las vistas públicas— para que el RLS de `patients` siga aplicando.

## Exportar a Excel

`.xlsx` de verdad, con `write-excel-file`. CSV parece suficiente hasta que
Excel se come el `+` de un teléfono, convierte `5550506060` a notación
científica y rompe los acentos; con datos mexicanos eso pasa siempre. Los
teléfonos van forzados a texto.

Las hojas clínicas **no se arman** si quien exporta es asistente, y las
consultas ni siquiera se lanzan. Confiar en que RLS las devuelva vacías sería
apoyarse en un efecto secundario.

## Reparto de datos del paciente

La regla para decidir dónde va un campo nuevo: **¿lo necesita el asistente
para operar la agenda?**

- Sí → `patients` (contacto, tutor, contacto de emergencia, seguro). Si un
  paciente se pone mal en la sala, la asistente tiene que poder llamar.
- No → `clinical_records` o `consultation_notes`, de solo dueño.

La presión arterial va como **texto** en el Excel: '100/65' como número Excel
lo convierte en fecha.

## Datos declarados por el paciente

`declared_records` es lo que el paciente escribió al agendar. **No es el
expediente.** Lo que teclea alguien a las once de la noche y lo que el médico
verificó en consulta no son el mismo dato, y si se vieran iguales alguien
recetaría sobre el equivocado.

- Se guarda por `declarar_datos_medicos`, que exige consentimiento explícito
  (los datos de salud son sensibles) y solo acepta escrituras dentro de las 24
  horas siguientes a la cita: si el id se filtrara, la ventana ya cerró.
- La ficha lo muestra en su propio bloque azul, marcado "sin verificar", nunca
  en la alerta roja de alergias confirmadas.
- `aceptar_datos_declarados` lo pasa al expediente **solo donde está vacío**:
  lo que el médico escribió manda. Lo declarado no se borra, queda marcado como
  revisado.

Si el paciente lo vuelve a cambiar, `reviewed_at` se limpia y hay que revisarlo
otra vez.

## Contacto: de quién es cada dato

Al agendar para otra persona, el contacto es de quien agenda. Va a
`tutor_phone` / `tutor_email` y **no** se copia a `phone` / `email`: hacerlo
mostraba el mismo teléfono en dos renglones que dicen cosas distintas.

El reconocimiento de un paciente que vuelve busca en los dos lados, porque el
contacto puede estar de cualquiera de ellos.

## Confirmación de asistencia

`status = 'confirmed'` significa que el **consultorio** aceptó la cita. Que el
**paciente** diga que viene es otra cosa, y es la que baja las inasistencias.

Va como marcas de tiempo (`confirmation_sent_at`, `patient_confirmed_at`), no
como valor del enum, a propósito: la restricción de solape filtra por
`status = 'confirmed'` y un estado nuevo quedaría fuera —el hueco se volvería
a ofrecer al público—. Ocho consultas más filtran por ese mismo valor. Como
columna, la interfaz muestra la distinción y la lógica de agenda no se entera.

## WhatsApp

Manual: `wa.me` abre la app o WhatsApp Web según el dispositivo, y la
recepcionista presiona enviar. Sin API de Meta, sin costo, sin aprobaciones.

El número se captura con **lada explícita** (`CampoTelefono`): un selector de
país más el número nacional. Adivinar el país por el largo funciona hasta el
primer número de Estados Unidos —también diez dígitos— y entonces el
recordatorio se va a un desconocido en Guadalajara.

Se guarda como `+52 5570708080`. `numeroParaWhatsApp` respeta el `+`: si ya
trae lada, no adivina nada. Los teléfonos viejos sin `+` siguen cayendo al
comportamiento anterior (diez dígitos = México), para no romper lo capturado.

El largo se **exige** solo en los países de `LADAS_FRECUENTES`, donde estoy
seguro del formato; en el resto se avisa pero se deja pasar. Equivocarse sobre
el largo de un país lejano no puede dejar a alguien sin poder agendar.

A un paciente que depende de alguien se le escribe **a su tutor**.

## La liga de la cita

Cada cita tiene un `access_token` (dos uuid pegados, 64 hex). La recepcionista
lo manda por WhatsApp y el paciente ve su cita, la confirma, avisa si no puede,
y adelanta sus datos médicos.

Se usa `gen_random_uuid` y no `gen_random_bytes` porque la primera es del
núcleo de Postgres; la segunda vive en el esquema `extensions` en Supabase,
fuera del search_path de las migraciones.

`ver_cita`, `confirmar_asistencia`, `cancelar_cita_paciente` y
`declarar_datos_medicos` son SECURITY DEFINER y se identifican con el token:
quien abre la liga no tiene sesión. `ver_cita` devuelve solo lo de esa cita,
nunca el resto de la agenda.

`solicitar_cita` devuelve el token, no el id: es lo que el paciente necesita
para volver a su cita.

La liga se ve en la Agenda, junto a cada cita: "Copiar liga", al lado del botón
de WhatsApp. Vivía solo dentro del mensaje de WhatsApp, y eso la volvía
inalcanzable cuando el paciente no tiene teléfono capturado o pide que se la
manden por otro lado. Sigue visible después de que el paciente confirmó: por
ahí adelanta sus datos y mueve la cita.

La liga saluda por su nombre a quien la abre, que no siempre es el paciente: si
la cita es de un menor, quien la abre es su tutor. `ver_cita` devuelve `paciente`
y `tutor` por separado en vez de que la página adivine con un solo nombre —
saludar y decir de quién es la cita son dos datos distintos, el mismo enredo que
`is_minor` vino a resolver.

- Adulto: "Hola, Carlos" / "Tu cita con".
- Menor: "Hola, Adriana" / "La cita de Ximena Robles con".
- `tutor` sale null si el paciente no es menor: un `tutor_name` viejo colgando
  de un adulto no convierte a nadie en su encargado.
- El renglón de la duración ya no repite "para X" cuando el encabezado nombró a
  esa persona.

Si la plantilla del recordatorio no trae `{liga}`, se agrega al final. Es lo
que deja al paciente confirmar solo, sin que la recepcionista tenga que
preguntarle.
