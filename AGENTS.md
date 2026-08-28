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

## Las dos jerarquías

Son dos escalas separadas y sin relación entre sí. Ser dueño de un consultorio
no da nada en la plataforma, y ser operador no mete a nadie en ningún
consultorio.

| Dónde | Roles | Dónde vive |
| --- | --- | --- |
| Dentro de un consultorio | `owner`, `assistant` | `memberships.role`, aplicado por RLS |
| Sobre la plataforma | `fundador`, `soporte` | `platform_admins.role` |

Supabase Auth **no tiene roles**: solo guarda identidades. Que en su panel se
vean todos los usuarios iguales es lo esperado; la autorización es nuestra.

`es_superadmin()` responde "puede entrar a la consola"; `es_operador()`
responde "puede cambiar algo". Soporte ve la consola completa para poder
ayudar, pero no suspende, no reactiva, no da de alta y no reparte permisos:
quien contesta el WhatsApp no tiene por qué poder apagarle el negocio a nadie.

Detalles:

- El rol por defecto es `soporte`. Dar de más es más fácil de hacer sin querer
  que dar de menos.
- No se puede quitar al **último fundador**: quedarse sin ninguno dejaría la
  plataforma sin quien la opere, y el arreglo sería entrar a la base a mano.
- Una cuenta de operador **no debe tener consultorio**. `handle_new_user` le
  arma uno a cualquier usuario nuevo, así que al crear un operador desde el
  panel de Supabase hay que borrárselo. La consola lo crea bien, con
  `signup_kind` distinto de `professional`.
- El mensaje de "no puedes" no menciona los roles: decirle a un médico
  cualquiera "soporte puede ver, no suspender" lo confunde y de paso le cuenta
  cómo está organizada la plataforma.

## La consola de plataforma

`/plataforma` es la consola de operación: dar de alta consultorios, activarlos
o desactivarlos, ver uso y ayudar a quien se atore. Un rol que ve a través de
todos los consultorios es lo más peligroso del sistema, así que se construyó
con tres reglas.

**No se toca el RLS de los consultorios.** Sería fácil agregarle
`or es_superadmin()` a cada política, y es justo como esto sale mal: se
ensancha en silencio cada permiso existente y ya nadie puede razonar qué ve
quién. El acceso va por funciones SECURITY DEFINER hechas para esto, cada una
revisando `es_superadmin()` en su primera línea.

**Nada clínico.** Ninguna función de plataforma toca `clinical_records`,
`consultation_notes`, `consultation_files` ni `declared_records`. Operar no
necesita leer el expediente de nadie, y lo que no se expone no se filtra. La
pantalla lo dice con todas sus letras, para que quede claro qué es esto.

**Todo queda anotado.** `platform_audit` guarda quién suspendió a quién y por
qué. El motivo es obligatorio: suspender apaga el negocio de alguien más.

Detalles que importan:

- `platform_admins` **no tiene políticas**: nadie la lee ni la escribe por la
  API. El primer operador se da de alta por SQL, y así nadie puede
  autonombrarse desde la aplicación.
- La puerta de la consola responde **404**, no 403: quien no es operador no
  tiene por qué enterarse de que existe. Y saltársela no daría acceso a nada,
  porque las funciones revisan por su cuenta.
- La suspensión muerde en tres lados, no solo en la UI: `public_professionals`
  filtra a los suspendidos (su página pública deja de existir), un trigger en
  `appointments` rechaza citas nuevas —`solicitar_cita` es SECURITY DEFINER y
  lee la tabla directo, así que sin el trigger una liga vieja seguiría
  agendando—, y `exigirConsultorio` manda a `/suspendido` en vez de a `/login`,
  donde la sesión válida los dejaría rebotando.

### Dar de alta un consultorio

Crear el usuario de auth necesita la llave de servicio, así que la acción vive
en el servidor y **lo primero que hace es preguntarle a la base, con la sesión
de quien pide y no con la llave, si esa persona es operador**. Sin ese paso,
cualquiera con sesión podría crearse consultorios.

De ahí en adelante lo arma `handle_new_user`, igual que en el registro normal.

No se manda contraseña: se crea la cuenta y el médico elige la suya con una
liga de un solo uso (`/definir-contrasena`). Una contraseña temporal tendría
que viajar por algún lado, y ese lado siempre termina siendo WhatsApp. La liga
se arma con el `hashed_token` y no con el `action_link` de Supabase, para que
pase por `/auth/confirm`, que ya sabe filtrar destinos.

`/definir-contrasena` no pide la contraseña anterior, al revés que
`/admin/cuenta`: aquí la credencial es la liga. Pedirle la de ahora a alguien
que nunca tuvo una no lleva a ningún lado.

### La ficha de soporte

`/plataforma/[id]` responde las preguntas que llegan por WhatsApp. La raya:
**la consola ve la operación, no el contenido.**

- Fechas, horas, estados y conteos, sí. Nombres de pacientes, teléfonos,
  correos y notas, **no** — para diagnosticar "no me aparece una cita" basta
  con cuándo y en qué quedó; el nombre no ayuda y es dato de un tercero que no
  es cliente de la plataforma. Una prueba revisa las columnas que devuelve
  `plataforma_citas` para que nadie las agregue de pasada.
- Los correos del **equipo** sí se ven: son las personas con las que la
  plataforma trata.
- "No tiene horario publicado" va arriba y en rojo: es la causa número uno de
  "mi liga no deja agendar", y verlo de inmediato ahorra la conversación.

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

## Correo saliente

Resend por HTTP (`src/lib/correo/enviar.ts`), sin SDK: es un POST con tres
campos y una dependencia menos en un servidor que ya mueve datos de salud.

El recordatorio se arma con **la misma plantilla** que el WhatsApp manual. Que
los dos canales digan lo mismo no es economía de código: es que al paciente le
llegue el mismo mensaje por donde sea. Y `{paciente}` es el nombre de **quien
recibe**, no el del paciente — a la cita de un menor se le escribe a su tutor,
y poner ahí al paciente saludaba al equivocado. De quién es la cita se dice
aparte, en el recuadro.

Sin dominio verificado en Resend, `onboarding@resend.dev` solo puede escribirle
al dueño de la cuenta. Sirve para probar; para producción hace falta el dominio.

## La invitación por correo

`invitarAsistente` manda la liga por correo, pero **el correo es una comodidad,
no la invitación**: la fila ya quedó grabada y la liga se puede copiar. Por eso
el envío no puede reventar la acción — un problema de Resend dejaría al médico
sin poder invitar a nadie. Si falla, se dice por qué y la liga sigue en
pantalla.

Los errores de Resend se traducen (`traducirResend`): llegan en inglés y hablan
de su producto. El más frecuente por mucho es el del dominio sin verificar, y
mientras no haya dominio **la invitación no le va a llegar a nadie que no sea
el dueño de la cuenta de Resend** — la liga a mano sigue siendo el camino real.

El correo no lleva más que la liga. Ni contraseña temporal ni datos del equipo:
quien lo recibe todavía no es miembro de nada.

## El no también se avisa

Rechazar una solicitud le manda correo al paciente. Sin eso, la solicitud
desaparece de la lista del consultorio y el paciente se queda esperando una
respuesta que nunca llega.

- El correo **no inventa un motivo**: casi nunca se captura, y uno inventado
  sería peor que ninguno. Ofrece lo único útil, que son otros horarios.
- El asunto no dice "rechazada": es lo que se lee en la bandeja antes de abrir.
- **Al médico no se le avisa de nada**, ni de solicitudes nuevas. Si tiene
  asistente, enterarse de cada una es justo el ruido que tener asistente vino
  a quitarle.

## El cron de recordatorios

`GET /api/recordatorios`, disparado por el cron de Vercel una vez al día
(`vercel.json`). En Hobby los crons corren una vez al día, y con la
anticipación por defecto de 24 h eso alcanza.

- Va con la llave de servicio (`createAdminClient`) porque mira las citas de
  todos los consultorios y no hay nadie en sesión. Por eso la puerta es
  `CRON_SECRET`, y **falla cerrado**: sin secreto configurado responde 503. Al
  revés —abierto mientras no se configure— cualquiera podría vaciar la agenda
  del día en correos.
- `appointments.reminder_sent_at` marca lo ya avisado. Vive en la cita y no en
  una tabla de envíos porque la pregunta de todos los días es "¿a esta ya le
  avisé?", y esa es de la cita.
- Si Resend falla, **no** se marca: mañana se reintenta. Un recordatorio
  repetido molesta; uno que nunca sale cuesta la cita. Si el paciente no tiene
  correo sí se marca, para que no se atore en cada corrida.
- `?destino=correo@x` manda un correo de muestra y no escribe nada. Es la
  única forma de probar el envío sin dispararle recordatorios a pacientes
  reales para averiguar si la llave sirve.

## Formularios

React 19 resetea los formularios después de cada acción. Donde perder lo
escrito sea molesto, los campos van controlados y se limpian solo al tener
éxito (`Formulario` acepta `onExito`).

## Texto con formato

La bio y la información de consulta se guardan como **Markdown de un
subconjunto mínimo** —negritas, cursivas y listas— y `TextoRico` las convierte
en nodos de React. Nunca se inyecta HTML: lo que el médico escribe termina en
nodos de texto, así que un `<script>` en su perfil no puede llegar a la página
pública. Esa es la razón de no usar un editor WYSIWYG sobre `contenteditable`,
no ahorrar una dependencia.

`EditorTexto` es WYSIWYG: un `contenteditable` que se ve como va a quedar, sin
asteriscos a la vista. En cada tecla se serializa el DOM a Markdown
(`aMarkdown`) y eso es lo que viaja en un `input` oculto. Al abrir, `aHtml`
hace el camino inverso.

- El serializador solo reconoce negritas, cursivas y las dos listas. Lo demás
  aporta su texto y nada más, así que lo que llega a la base queda acotado por
  construcción y no por un saneador que hay que mantener al día.
- Es **recursivo**: el navegador no promete dónde deja una lista, y mirando
  solo el primer nivel se aplastaba en una línea sin viñetas.
- Pegar va como texto plano: lo de Word trae estilos, fuentes y markup entero.
- El contenido inicial se siembra en un efecto que corre una sola vez. Si React
  repintara el `contenteditable`, el cursor saltaría al inicio en cada tecla.
- Usa `execCommand`, obsoleto pero lo único que funciona en todos lados sin
  traerse un editor entero. El día que desaparezca se cambia esta capa: el
  formato guardado no se entera.
- CRLF: en una expresión regular de JS `\r` es fin de línea, así que `.` no lo
  cruza y `$` no llega. Sin normalizarlo, una viñeta guardada con CRLF dejaba
  de reconocerse como viñeta.

`TextoExpandible` recorta y ofrece "Ver más". El recorte puede partir un
marcador a la mitad y dejar el asterisco crudo a la vista, así que
`cerrarMarcadores` cierra lo que quedó abierto antes de renderizar.

La especialidad va con `datalist` en los **tres** lugares donde se captura —el
perfil, el registro y el alta desde la consola—: lista sugerida, no catálogo
cerrado. Si solo estuviera en uno, los otros dos seguirían generando las
variantes que esto vino a evitar.

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

## Confirmar antes de lo que no tiene vuelta

`ConfirmarAccion` es un `<dialog>` nativo: trae foco atrapado, Escape y fondo
inerte sin reimplementarlos mal. Se abre con `showModal()` desde un efecto,
porque el atributo `open` renderiza el diálogo **sin** modalidad.

Se cierra al confirmar, no cuando responde el servidor: esperar con el diálogo
encima parece que no pasó nada. El error, si lo hay, sale en la fila.

Cancelar una cita lo usa. No es como quitar una franja del horario: del otro
lado hay una persona que ya apartó ese día, y muchas veces ya confirmó que
viene — el diálogo lo dice con esas palabras.

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
- El selector de estado se etiqueta por lista: en el Historial la opción vacía
  es "Todos", en Solicitudes es "Por revisar" — ahí lo no filtrado es lo que
  espera decisión, y llamarle "Todos" mentiría. Filtrando por un estado ya
  decidido desaparecen Aceptar y Rechazar: ofrecerlos sería mentir también.

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

## De dónde llegó el paciente

`patients.source` y `patients.referred_by`. Las opciones son las que se pueden
accionar distinto, no las que suenan bien en un reporte: a un colega que
refiere se le llama, a un paciente que recomienda se le agradece, y un
directorio se paga. Por eso `medico`, `paciente` y `directorio` están
separados aunque los tres cabrían en "recomendación".

- La pregunta "¿quién?" solo aparece con `paciente` y `medico`. Preguntársela
  a alguien que llegó por Google es ruido, y un campo que casi siempre sobra
  se deja vacío también cuando importa.
- `recurrente` solo se ofrece en la página pública: es la respuesta de quien
  ya es paciente. Contarlo como captación nueva inflaría cualquier medición.
- `null` significa "no se preguntó", que es distinto de `otro`.
- Se muestra en dos lados y responden preguntas distintas: en la **ficha** el
  dato dice cómo tratar a esa persona; en **Pacientes**, el corte "De dónde
  llegan" responde en qué invertir y a quién agradecerle. El corte mira a todos
  los pacientes, no a la página que se está viendo.
- El origen se guarda **solo al crear la ficha**. A quien vuelve a agendar no
  se le reescribe de dónde vino la primera vez.
- `create or replace function` con distinta cantidad de parámetros no
  reemplaza: **crea una sobrecarga**. Al agregarle `p_origen` y `p_referido` a
  `solicitar_cita` quedaron dos, y toda llamada con la firma vieja se volvió
  ambigua. Hubo que borrar la anterior a mano.

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

## El workspace de la consulta

`/admin/consulta/[citaId]` es donde el médico trabaja mientras tiene al paciente
enfrente. Se entra desde la agenda (que es donde está cuando el paciente llega)
o desde la bitácora de la ficha.

- **Una sola puerta para escribir**: el formulario plegado que vivía dentro de
  la bitácora desapareció. El mismo expediente en dos pantallas distintas es
  cómo se terminan escribiendo dos versiones de lo mismo. `FormularioConsulta`
  se extrajo del componente plegable justamente para que solo existan unos
  campos clínicos.
- La columna de contexto responde lo que se pregunta en consulta: por qué vino,
  qué declaró y no se ha verificado, qué se le encontró la vez pasada, a quién
  se le avisa. Las alergias y padecimientos van arriba, en rojo, fuera de las
  columnas.
- **El paciente que llegó sin cita**: toda nota clínica cuelga de una cita
  (`consultation_notes.appointment_id` es obligatorio y único), así que
  "Registrar una consulta" en la bitácora crea primero la cita y abre el
  workspace. Nace **`completed`**, no `confirmed`, por dos razones: ya ocurrió,
  y la restricción de solape solo mira las `confirmed` — si naciera confirmada,
  a alguien que llegó de pronto mientras había otra cita agendada se le
  rechazaría con "ese horario no está disponible", por algo que ya pasó.
- Cerrar la cita ("Se atendió" / "No asistió") solo aparece si ya ocurrió, la
  misma regla que en la agenda.
- El asistente que abra la liga ve un aviso, no un error: la agenda sigue
  siendo suya.

## Estudios y documentos

Bucket `expedientes`, en `{professional_id}/{patient_id}/{timestamp}-{archivo}`,
con la tabla `consultation_files` al lado. Storage guarda el archivo; la tabla
guarda de quién es y qué es — si no, habría que leerlo del nombre del archivo,
que lo pone quien sube.

- El bucket es **privado**, al revés que `fotos-perfil`. Aquella foto se
  publica en la página del médico; esto es el estudio de una persona
  identificada, y una URL pública adivinable sería una filtración. Se abren con
  ligas firmadas que se generan en el servidor y vencen a los 15 minutos.
- **Solo dueño**, con `is_owner` y no `is_member`: un laboratorio es tan clínico
  como una alergia. Esto significa que el asistente no puede adjuntar lo que
  llega por WhatsApp, y es a propósito — cambiarlo es abrirle el expediente.
- El nombre del archivo llega como lo puso el celular de alguien: acentos,
  espacios y a veces `../`. La ruta se arma con uno saneado y el original se
  guarda aparte, que es el que el médico reconoce.
- Al fallar se limpia en las dos direcciones: si la fila no se puede insertar,
  el archivo se borra; al borrar, la fila se va primero, para no dejar un
  renglón apuntando a algo que ya no existe.

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

Los signos vitales avisan **al escribir**, no al guardar: enterarse después de
haber capturado toda la consulta es tarde. Y el aviso conoce el error de
verdad —"¿son gramos? 3500 g son 3.50 kg"— porque en pediatría el peso del
recién nacido se dice en gramos. La pista reemplaza al mensaje de rango pero
no lo ablanda: sigue bloqueando el guardado, porque un aviso que se puede
ignorar termina siendo un dato malo en el expediente.

Las columnas se ensancharon (`numeric(6,2)`) por una razón de orden: el
desbordamiento ocurre al convertir el valor, **antes** de evaluar el CHECK, así
que con la precisión justa salía "numeric field overflow" en vez del mensaje
que sí explica el problema.

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

El trigger que la valida mira **el acto de confirmar**, no el estado en
general. Cuando miraba las dos cosas, una cita que el paciente ya había
confirmado quedaba trabada: no se podía cancelar, ni cerrar, ni marcar
inasistencia, ni reagendar — y el error que salía hablaba de confirmación, que
no tenía nada que ver con lo que se estaba intentando.

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
