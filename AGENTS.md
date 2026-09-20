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

## El dominio

El oficial es **`https://www.citapedia.com`**, conectado el 12 de septiembre de
2026; el apex redirige al www con 308. `citapedia.vercel.app` sigue sirviendo
—Vercel no lo quita— pero **no se usa en ningún lado**: ni en código, ni en
respaldos, ni en las pruebas.

Todo sale de `NEXT_PUBLIC_SITE_URL` a través de `src/lib/sitio.ts`:

- `baseDelSitio()` da la dirección completa, y es el **único** respaldo que
  queda. El cron tenía el suyo propio apuntando al vercel.app, que es como un
  dominio viejo sobrevive a su jubilación: escondido en un `??` que solo se
  nota el día que la variable falta.
- `dominioPublico()` la muestra sin esquema y **sin `www.`** — `citapedia.com/dr-x`
  es lo que se dicta en el mostrador, y el apex redirige solo.

### Una variable mal puesta no se ve al ponerla

`NEXT_PUBLIC_SITE_URL` quedó una vez con la URL de **Supabase**. Las ligas se
arman pegándola con la ruta, así que la de acceso de un médico lo mandaba a la
base de datos, que contesta "No API key found in request" — un mensaje que no
menciona nada de esto. No se notó al guardar la variable: se notó días después,
con el médico al teléfono sin poder entrar.

`problemaDelSitio()` la revisa —vacía, sin `https://`, o apuntando a
`*.supabase.co`— y las acciones que reparten ligas se niegan con ese texto en
vez de entregar una liga rota. En `regenerarAcceso` va **antes** de generar:
`generateLink` mata la anterior en cuanto se llama, así que descubrirlo después
dejaría al médico peor que como estaba. En `/recuperar`, donde nadie lee
errores a propósito, se anota en `email_failures`.

`npm run test:sitio` cubre los valores que ya se colaron de verdad.

## La liga que se comparte

El médico manda su liga por WhatsApp, y una liga sin vista previa se ve como
las que uno no abre. `opengraph-image.tsx` dibuja la tarjeta: foto —o la
inicial, porque casi nadie sube foto el primer día—, nombre, especialidad, un
resumen de la bio y el dominio.

- La descripción pasa por `enTextoPlano`: la bio es Markdown y sin aplanarla
  la vista previa decía "egresado de la **UNAM**", con los asteriscos crudos.
- `metadataBase` sale de `NEXT_PUBLIC_SITE_URL`. WhatsApp no resuelve rutas
  relativas: sin esa base, la imagen no carga.
- Satori (el que dibuja la imagen) **exige `display: flex` en cualquier div con
  más de un hijo**, y `{dominio}/{slug}` son tres nodos. Se arma la cadena
  antes de meterla al div.
- El dominio se enseña sin `www.` (`dominioPublico`): el apex redirige solo y
  es más corto de dictar en el mostrador.

### Las ligas que se comparten

Regla: **lo que sale del admin abre en otra pestaña y se puede copiar.** La
navegación interna del admin no — abrir Pacientes en una pestaña nueva sería
molesto, no útil.

Cae en la regla la página pública del médico (el pie del admin, el campo de
slug en Mi página, la ficha de la consola), la liga de cada cita y WhatsApp.
Quien las abre está a media tarea y no quiere perder donde estaba; y quien las
comparte necesita copiarlas, porque dictar por teléfono `citapedia.com/dr-jesus-garcia`
es cómo se llega a un paciente en una página que no existe.

Se copia la forma **corta**, sin `www.`: es la que se lee en pantalla, y el
apex redirige con 308 — hasta la vista previa de WhatsApp sigue el redirect.

## Fotos

Las fotos de perfil van a Supabase Storage, bucket `fotos-perfil`, en la ruta
`{professional_id}/perfil-{timestamp}.{ext}`. El bucket es público (la foto se
ve en la página del médico) pero escribir está restringido por políticas sobre
`storage.objects`: cada consultorio solo toca su carpeta. Límites de tamaño y
tipo están en el propio bucket, no solo en la app.

**El cuerpo de una Server Action son 1 MB por defecto**, y la foto admite 5.
Una foto de celular pesa dos o tres, así que Next rechazaba la petición
*antes* de entrar a la acción: el médico veía una pantalla de error con un
código (`…@E394`, que es un 413 disfrazado) en lugar del mensaje de tamaño.
`next.config.ts` sube el límite a 6 MB —un poco arriba del tope real, para que
quien decida sea nuestra validación y no el framework— y el componente revisa
el peso **antes de subir**: mandar ocho megas por la red del consultorio para
que del otro lado digan que no es esperar un minuto para nada.

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

### Volver a dar la liga de acceso

La liga del alta se genera una sola vez y no se guarda: vence en una hora, se
quema al abrirla, y `generateLink` mata la anterior en cuanto se llama otra
vez. Cuando eso pasaba, la única salida era entrar a Supabase a mano —y
`/recuperar` no sirve de nada mientras Resend no tenga dominio, porque el
correo no le llega al médico.

`regenerarAcceso` la vuelve a armar desde la ficha de soporte, junto a cada
correo del equipo. Dos cosas que la separan del resto de la consola:

- Va con `es_operador`, no con `es_superadmin`. Esta liga deja entrar a una
  cuenta ajena; quien contesta el WhatsApp no tiene por qué poder hacerlo.
- El correo se valida contra `plataforma_equipo` del mismo consultorio. Sin esa
  vuelta, la acción generaría una liga de entrada para cualquier dirección que
  le dictaran, incluida la de otro operador.

Se muestra en pantalla en vez de mandarse por correo, por la misma razón que la
invitación: sin dominio verificado el correo no llega, y quien está en la
llamada la puede pegar donde el médico la espera. Queda anotada en
`platform_audit` como `liga`.

### La liga no se gasta con abrirla

La primera versión mandaba la liga de recuperación de Supabase, y esa **se
quema al abrirla**: quien la abría, miraba la pantalla y se iba a pensar una
contraseña, volvía a una liga muerta sin haber cambiado nada. Y duraba una
hora, que no alcanza cuando se manda por WhatsApp a alguien que está en
consulta.

La liga ahora es nuestra (`access_grants`, ruta `/acceso/[token]`), así que
nosotros decidimos cuándo muere: **48 horas, se puede abrir las veces que haga
falta, y se marca usada al PONER la contraseña**, no al abrirla.

- El token de Supabase se pide dentro de `/acceso/[token]`, en el servidor, y
  se canjea ahí mismo. Nunca sale al navegador y sigue siendo de un solo uso;
  lo que se repite es armarlo.
- Crear una liga nueva mata las anteriores sin usar. Si convivieran, la que
  quedó en un chat de hace tres días seguiría entrando.
- `access_grants` **no tiene políticas**: guarda credenciales de entrada y solo
  la toca el servidor con la llave de servicio, igual que `platform_admins`.
- `plataforma_usuario_del_equipo` traduce correo a usuario y revalida, en la
  base, que sea de ese consultorio.

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

## El tope de solicitudes

Ya había un tope de 3 pendientes por contacto, pero se apoya en el teléfono y
el correo que teclea quien agenda: cambiarlos en cada intento lo salta.

El tope nuevo es **por hueco** (5), y la elección importa: un tope global por
consultorio sería un arma —quien quisiera hacer daño lo llenaría y dejaría al
médico sin poder recibir citas de verdad, con la defensa convertida en el
ataque—. Por hueco, el daño queda acotado a (huecos publicados × 5) y un
paciente real siempre puede pedir otro horario. Hay una prueba que verifica
justo eso: llenar un hueco no bloquea los demás.

Esto **acota el daño, no detiene a alguien decidido**. Un ataque en serio se
para antes de llegar a la base, con límites por IP en el borde (el firewall de
Vercel o BotID). Lo que evita es que un script tonto o un formulario en bucle
inutilicen la pantalla de Solicitudes.

## Permisos de las funciones

En Postgres **toda función nace con `EXECUTE` para `PUBLIC`**. Los
`grant execute ... to authenticated` que se escribieron durante meses eran
redundantes: no añadían nada, porque el permiso ya lo tenía todo el mundo.
`anon` —cuya llave viaja en el HTML— podía llamar `plataforma_suspender`.

No había agujero abierto, porque cada función revisa `es_operador()` por
dentro. Pero el modelo estaba al revés: la seguridad dependía de que nadie
olvidara nunca la revisión, en vez de depender de que nadie tuviera el permiso.

Ahora se revoca todo y se concede nombre por nombre. **Ojo al agregar una
función: hay que mirar también dónde se USA, no solo quién la llama desde la
aplicación.** Las restricciones CHECK se evalúan con los privilegios de quien
escribe, así que `slug_reservado` —que vive dentro de un CHECK— necesita
EXECUTE de `authenticated` o cambiar el slug del perfil revienta. Los triggers
no tienen ese problema: su permiso se revisa al crearlos, no al dispararse. **Al agregar una función
nueva hay que concederla explícitamente**, o no la va a poder llamar nadie —
que es el lado seguro del olvido. Una prueba del esquema falla si `anon`
alcanza algo que no sea `solicitar_cita` o `ver_cita`.

El harness de PGlite ya **no** hace `grant execute on all functions`: lo hacía
para parecerse a Supabase, y desde este cambio eso lo alejaría de producción
justo en lo que se quiso cerrar.

## Índices

- Postgres **no indexa las claves foráneas solo**. Sin índice, cada borrado del
  lado padre recorre la tabla hija entera.
- Se dejaron a propósito sin índice las columnas de autoría —`author_id`,
  `uploaded_by`, `reviewed_by`, `actor_id`—: solo se recorren al borrar un
  usuario de auth, que casi no pasa, y un índice se paga en cada escritura.
- `appointments_agenda_idx (professional_id, status, starts_at)` es el camino
  caliente: agenda, solicitudes, historial y métricas preguntan las tres cosas
  juntas. El índice suelto de `status` se quitó — con `professional_id` al
  frente queda cubierto, y uno de más cuesta en cada escritura.

## Contar es trabajo de la base

"De dónde llegan" traía **todos** los pacientes a la aplicación para contarlos
en JavaScript, y la lista de la consola hacía seis subconsultas correlacionadas
**por consultorio**. Con veinte pacientes y cuatro consultorios no se nota; con
cinco mil y mil, son cinco mil renglones por carga y seis mil consultas. Los
dos pasaron a agregados (`origenes_consultorio`, `recomendantes_consultorio`,
`cobertura_origen`, y CTEs en `plataforma_consultorios`).

## Despliegue

Vercel construye cada push a cualquier rama como Preview, y `main` como
Production. Con el flujo de rama → PR → merge, eso son dos builds por cambio.

Durante meses `vercel.json` cancelaba los Preview: la verificación era en
localhost y el build de más no compraba nada. **Eso cambió cuando entró el
primer consultorio de verdad**: hoy cada cambio necesita haber corrido en un
servidor antes de tocarle la agenda a alguien, y el Preview es la única forma
de abrirlo sin desplegar a producción. El build de más se paga a gusto.

Si algún día hay que volver a apagarlos, dos trampas ya cobradas:

- En `ignoreCommand`, **salir con 0 cancela** el build y salir con 1 lo deja
  correr, al revés de lo que se espera de un código de salida.
- La condición tiene que preguntar si el entorno **es** preview, no si **no es**
  producción. Con la forma negada, un `VERCEL_ENV` vacío cancelaba producción
  y el sitio se quedó servido en el build anterior sin que nada marcara error.

## La revisión automática

`.github/workflows/ci.yml` corre lint → tipos → pruebas → build en cada PR y en
cada push a `main`. Antes eso vivía en la máquina de quien programaba y solo si
se acordaba.

No necesita secretos, y conviene que siga siendo así: el build no toca Supabase
—todas las páginas con datos son dinámicas— y el esquema se prueba contra
PGlite, en WASM. El día que una prueba pida una llave, lo que hay que revisar es
la prueba.

## Correo saliente

Resend por HTTP (`src/lib/correo/enviar.ts`), sin SDK: es un POST con tres
campos y una dependencia menos en un servidor que ya mueve datos de salud.

El recordatorio se arma con **la misma plantilla** que el WhatsApp manual. Que
los dos canales digan lo mismo no es economía de código: es que al paciente le
llegue el mismo mensaje por donde sea. Y `{paciente}` es el nombre de **quien
recibe**, no el del paciente — a la cita de un menor se le escribe a su tutor,
y poner ahí al paciente saludaba al equivocado. De quién es la cita se dice
aparte, en el recuadro.

El remitente sale de `RESEND_FROM` y es una dirección del dominio que **nadie
lee**. Por eso los correos al paciente llevan `reply_to` con el correo del
consultorio: quien contesta "no voy a poder llegar" le está hablando a su
médico, no a CitaPedia, y sin eso su mensaje se pierde. Lo llevan la cita
aceptada, la rechazada, el recordatorio, el aviso programado y la invitación.

**El de recuperar contraseña no lo lleva, a propósito.** Ese correo no saluda
por su nombre ni menciona el consultorio, porque quien pidió recuperar puede no
ser el dueño de la cuenta; poner ahí la dirección del consultorio contaría justo
lo que se está callando.

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

## El acuse de la solicitud

Quien agenda a las once de la noche cerraba la pestaña y no le quedaba nada: ni
constancia de lo que pidió, ni la liga de su cita, ni idea de que todavía falta
que el consultorio la apruebe. Al día siguiente no sabía si había mandado algo.

`armarSolicitudRecibida` se lo dice, y **evita con cuidado la palabra
"confirmada"** —en el asunto y en el cuerpo—: la cita nace `requested` y el
médico decide. Prometer aquí lo que no está prometido es cómo se llega a que
alguien se presente un martes a una cita que nadie aceptó. Hay una prueba que
falla si la palabra se cuela.

El envío va envuelto y **nunca puede tumbar la reserva**: la cita ya quedó
pedida, y un problema de Resend no puede volverse "no pudimos registrar tu
solicitud" para alguien que sí la registró. Lo peor que hace es anotarse en
`email_failures` como `solicitud`.

Va con la llave de servicio porque quien reserva no tiene sesión, y el correo
del consultorio —el del `reply_to`— no está en la vista pública, a propósito.

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

## Los correos que nadie mira

Casi todos los envíos tienen a alguien enfrente: la invitación y los avisos de
aceptar o rechazar fallan en pantalla, frente a la recepcionista. Dos no: la
**recuperación de contraseña**, que se calla a propósito para no delatar qué
cuentas existen, y el **cron de recordatorios**, que corre de madrugada sin
nadie leyendo su respuesta. Si Resend deja de entregar un martes, esos dos
fallan en silencio hasta que alguien no puede entrar o un paciente no llega.

`email_failures` los recoge y la consola de plataforma los muestra agrupados
por motivo **y con la fecha de la última vez**. Esa fecha no es decoración: sin
ella, un problema ya resuelto —"no hay dominio verificado", después de haberlo
verificado— se sigue leyendo como si estuviera pasando ahora, y una alerta que
miente deja de mirarse. **No se guarda el destinatario**: en recuperación la dirección
sería una lista de quién tiene cuenta, y en recordatorios es el correo de un
paciente. Lo accionable es el motivo, que además casi siempre es global — "no
hay dominio verificado" no se arregla paciente por paciente. Una prueba revisa
las columnas para que nadie agregue la dirección de pasada.

`anotarFalloDeCorreo` nunca recibe la liga: es una credencial, y escribirla en
una tabla o en un log la vuelve reutilizable por quien lea cualquiera de los
dos.

### El médico escribe el recordatorio

Es lo único que el paciente lee del consultorio entre que agenda y que llega, y
decía lo mismo para todos. Un pediatra que quiere pedir la cartilla de
vacunación no tenía dónde escribirlo; cambiarlo era entrar por SQL.

Vive en `/admin/horario`, que es la página de cómo trabaja el consultorio.

- **La vista previa no es adorno.** La plantilla está llena de llaves y nadie
  puede leer `Hola {paciente}` y saber cómo va a sonar. El ejemplo se arma con
  la misma función que el envío de verdad, así que lo que se ve es lo que sale.
- **Una variable inventada se manda tal cual**: el paciente recibiría "Hola
  {nombre}". `variablesDesconocidas` la caza al guardar, que es el último
  momento en que hay alguien enfrente para corregirla.
- Es de **equipo**, no solo del dueño: quien redacta los mensajes suele ser
  quien contesta el teléfono.
- **No se ofrece la anticipación** (`hours_before`). El cron de Hobby corre una
  vez al día, así que un selector de horas prometería una precisión que no
  existe.
- `PLANTILLA_POR_DEFECTO` y `conLiga` viven en `whatsapp.ts`. Estaban copiadas
  en cuatro archivos, y con el texto ya editable eso empeora: cambiar el default
  en tres de los cuatro deja a alguien recibiendo una versión que nadie escribió.

### Tres toques, no uno

Un solo correo llega tarde para lo que el paciente tiene que hacer con él:
pedir el día en el trabajo, o conseguir hueco en la agenda. Y si no reacciona,
nadie vuelve a insistir.

| | Cita | Aviso programado |
| --- | --- | --- |
| Con tiempo | 7 días antes | 7 días antes de vencer |
| En su momento | la víspera (`hours_before`) | el día que vence |
| Si no se movió | el día de la cita, **solo si no confirmó** | 7 días después, **solo si no agendó** |

- **Cada etapa tiene su propia marca** (`reminder_early_sent_at`,
  `reminder_sent_at`, `reminder_final_sent_at`; `early_sent_at`, `sent_at`,
  `followup_sent_at`) y no un contador: así se sabe cuál salió y cuándo, y una
  etapa que falle no arrastra a las demás.
- **El último jalón exige que la víspera haya salido hace más de 12 horas.**
  Sin eso, la misma corrida mandaría los dos con minutos de diferencia.
- **La anticipación configurada (`hours_before`) manda solo en la víspera.** Las
  otras dos tienen su momento propio y no son negociables.
- **`tiene_cita_por_venir` decide el seguimiento.** Insistirle a quien ya hizo
  caso es como se pierde la confianza en un canal: la siguiente vez ya no lo
  abre. Cuando ya agendó, el aviso se marca igual —para no volver a mirarlo—
  pero no se manda nada.
- **Solo el toque del día vencido cierra el aviso** (`status = 'enviado'`). Los
  otros dos son acompañamiento; cerrarlos antes lo sacaría de la lista que
  trabaja la recepcionista cuando todavía no ha pasado nada.
- El texto del médico es el mismo en las tres: es su voz. Lo que cambia es el
  asunto y la línea que dice a qué viene ese correo — tres motivos distintos
  merecen tres encabezados distintos.

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
subconjunto mínimo** —negritas, cursivas, tachado, ligas, citas y listas— y
`TextoRico` las convierte
en nodos de React. Nunca se inyecta HTML: lo que el médico escribe termina en
nodos de texto, así que un `<script>` en su perfil no puede llegar a la página
pública. Esa es la razón de no usar un editor WYSIWYG sobre `contenteditable`,
no ahorrar una dependencia.

`EditorTexto` es WYSIWYG: un `contenteditable` que se ve como va a quedar, sin
asteriscos a la vista. En cada tecla se serializa el DOM a Markdown
(`aMarkdown`) y eso es lo que viaja en un `input` oculto. Al abrir, `aHtml`
hace el camino inverso.

- El serializador solo reconoce lo que la barra produce: negritas, cursivas,
  tachado, ligas, citas y las dos listas. Lo demás
  aporta su texto y nada más, así que lo que llega a la base queda acotado por
  construcción y no por un saneador que hay que mantener al día.
- Es **recursivo**: el navegador no promete dónde deja una lista, y mirando
  solo el primer nivel se aplastaba en una línea sin viñetas.
- **Las ligas solo son ligas si son http o https** (`ligaSegura`). Lo escribe
  el médico, pero lo lee cualquiera: un `javascript:` en su perfil sería un
  clic ejecutable en la página pública. Lo que no pasa el filtro se muestra
  como texto, en el editor y en la página. Van con
  `rel="noopener noreferrer nofollow"`.
- **No hay subrayado**, y es a propósito: en una página web el subrayado
  significa liga, y Markdown no tiene manera de expresarlo — habría que
  inventar un marcador propio para un formato que además confunde.
- Una cita se serializa en **un** renglón si adentro solo hay formato en línea.
  Recorriendo siempre, `<b>Hola</b> y <i>adiós</i>` salía en tres renglones y
  cada uno se leía como una cita distinta.
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

Si ese correo **ya tiene cuenta**, la pantalla ofrece "Entrar y aceptar" en vez
de "Crear mi cuenta". Antes el botón grande decía crear, y quien ya tenía
cuenta chocaba con "Ese correo ya tiene cuenta. Entra en su lugar" — cierto,
pero sin salida, y en el primer minuto de alguien en el sistema.

`correo_registrado` contesta eso y se concede **solo a `service_role`**: saber
si una dirección tiene cuenta es justo lo que una pantalla pública no debe
poder preguntar a voluntad. La pregunta la hace el servidor, y solo sobre el
correo que ya venía escrito en una invitación válida. Si la llave de servicio
no está, se ofrecen los dos botones como antes.

`miembros_del_consultorio()` expone los correos de `auth.users`, pero solo de
los consultorios de los que quien pregunta ya es miembro.

## Un error no es un "no existe"

Las lecturas públicas tiraban el `error` de Supabase y se quedaban con `data`,
así que una llave rota o la base caída se veía **idéntica** a que el
consultorio no existiera: un 404 limpio, sin nada en los logs. Pasó de verdad
—la página de un médico dejó de abrir y el sitio no marcó ningún error— y es
la peor forma de fallar, porque nadie se entera.

Ahora las consultas de `cargarPaginaPublica` y de `/cita/[token]` revientan si
la consulta falla. 404 significa "no hay fila"; 500 significa "no pude
preguntar". Y una lista que falla no puede pasar por lista vacía: sin horario
la página diría "no hay huecos", que es una mentira con cara de dato.

## Redirecciones

`next` solo acepta rutas internas (`/…`, y nunca `//…`). Sin ese filtro, el
login y la confirmación de correo se vuelven un trampolín para mandar gente a
dominios de terceros.

## Avisos programados

`patient_alerts` es la fase 3 del post-venta. La diferencia con el recordatorio
de cita es la que ordena el diseño: **un recordatorio cuelga de una cita y su
fecha ya existe; un aviso cuelga del paciente y su fecha se elige.** Mezclarlos
en la misma tabla obligaría a inventarle una cita a cada aviso.

- Es de **equipo** (`is_member`), no solo del dueño: el asistente es quien va a
  trabajar la lista y mandar los mensajes.
- El cron los manda en la misma corrida que los recordatorios: es el mismo
  trabajo, y un segundo cron sería otra cosa que puede fallar en silencio.
- Un aviso sin correo **no se marca**: se queda en la lista para que alguien lo
  mande por WhatsApp. Al revés que el recordatorio, aquí no hay una cita que se
  pierda por esperar.
- La lista en Inicio existe aunque el cron los mande solo: mientras no haya
  dominio verificado el correo no sale, y sin ella el módulo no serviría de
  nada hasta entonces.
- El correo **no inventa contexto clínico**: dice lo que escribió el médico y
  ofrece agendar. Que CitaPedia agregue "es momento de tu vacuna" sería
  afirmar algo médico que nadie revisó.

### Los avisos que se repiten

Fase 4. Un aviso suelto lleva **una fecha**; una plantilla lleva **la regla**
para calcularla, y ahí está toda la diferencia: "a los 6 meses de nacido" sirve
para todos los pacientes, "el 15 de marzo" sirve para uno.

`alert_templates` guarda título, mensaje, desde dónde se cuenta (`nacimiento`,
`ultima_visita`, `hoy`) y cuántos meses. Se administran en `/admin/horario`
—son del consultorio, no del paciente que uno tenga abierto— y se aplican desde
la ficha, con la fecha ya calculada a la vista: sin verla, aplicar una es una
apuesta, porque "a los 6 meses" no dice nada hasta saber que eso cae en marzo.

- **La cuenta vive en la base** (`fecha_de_plantilla`). La necesitan la pantalla
  y el guardado, y dos copias de una cuenta de fechas terminan discrepando.
- **Una fecha ya pasada se rechaza.** El cron manda todo lo que vence hoy o
  antes: aplicarle "a los 6 meses" a un niño de cuatro años le mandaría mañana
  un correo por unas vacunas que le tocaban en 2022.
- **Sin fecha de origen lo dice**, en vez de inventar una. A un paciente sin
  fecha de nacimiento no se le puede calcular "a los 6 meses".
- `ultima_visita` mira las citas `completed` y no las notas de consulta: las
  notas son de solo dueño, y esto lo usa el equipo.
- Las constantes compartidas viven en `avisos/bases.ts`. Un archivo
  `'use server'` **solo puede exportar funciones async**; una constante ahí
  truena el build entero.

### Cuáles recomendarle a este paciente

Fase 5. Lo que se recomienda son **las plantillas que el médico ya escribió**,
nunca un catálogo clínico nuestro: sugerir un esquema de vacunación es una
afirmación médica y CitaPedia no tiene con qué respaldarla. Ordenar lo que él
ya decidió, sí.

`plantillas_para_paciente` contesta las tres señales de una vez, y las tres son
de su propia operación:

- **cuándo caería** para este paciente,
- **si ya se la programó** —para no duplicarla; sale marcada con ✓ y
  deshabilitada—,
- **con cuántos de sus pacientes la usa**, que aparece en el título del botón a
  partir de tres. No es una recomendación nuestra: es su costumbre, leída de
  sus propios datos.

El orden es por lo accionable: primero lo que se puede programar hoy, después
lo ya programado, al final lo que no aplica. Una plantilla sin fecha
calculable **se sigue ofreciendo**, deshabilitada y con el motivo: sirve para
decir por qué no se puede, no para esconderla.

Reemplazó una consulta por plantilla desde la ficha. Con tres no se notaba;
con veinte y una sala llena, sí.

## El seguimiento post-consulta

"Te veo en tres meses" se dice en casi todas las consultas y vivía en la
memoria de dos personas, que es donde se pierde.

`consultation_notes.follow_up_at` guarda cuándo debe volver. Va en la **nota** y
no en el paciente a propósito: es una indicación de ESA consulta, así que la de
la visita siguiente no borra esta y cada una queda con su historia.

Los botones de plazo (1, 3, 6 meses, 1 año) están porque nadie va a abrir un
calendario y contar noventa días con el paciente enfrente. Si cuesta, no se
llena; y un campo que no se llena no existe.

`controles_pendientes()` es la lista que trabaja la recepcionista, y **excluye a
quien ya tiene cita agendada**. No es un detalle: llamarle a alguien que ya
viene el jueves quema la confianza en la lista, y una lista en la que no se
confía se deja de abrir. Va con quince días de gracia, porque alguien a quien
"le tocaba el martes" sigue siendo una llamada que vale la pena el jueves.

Aparece en Inicio **antes que los números**: son llamadas que se pueden hacer
hoy, no información para mirar.

## Inicio

`/admin` **es** Inicio: los primeros pasos, los números del consultorio y de
dónde llegan sus pacientes. La agenda vive en `/admin/agenda`.

Al principio fue al revés —la agenda en `/admin`, con el argumento de que es lo
que se abre todos los días— y se cambió a propósito: al entrar conviene ver
primero qué pide atención, no la lista de citas. El costo es un clic diario
para llegar a la agenda, y es un costo aceptado, no un descuido.

`esActiva` trata `/admin/calendario` como parte de Agenda: el calendario es la
agenda vista de otra forma, no una sección aparte. E Inicio se compara exacto,
porque con `startsWith` se prendería en todas las demás.

`metricas_consultorio` va con **SECURITY INVOKER**: son los datos del propio
médico y RLS ya sabe cuáles son suyos. Elevarse le daría la capacidad de ver
consultorios ajenos sin ninguna razón para tenerla.

Devuelve **conteos crudos, no porcentajes**. Un "33% de inasistencia" sobre
tres citas es ruido con aspecto de dato; que la pantalla vea el denominador es
lo que le permite callarse cuando no hay de dónde concluir — y por eso el
comparativo de confirmación exige al menos 10 citas cerradas de cada lado
antes de mostrarse.

El periodo vive en la URL (`?periodo=` o `?desde=&hasta=`), como el resto de
los filtros. Lo que **no** se filtra es "ahora mismo": por revisar, por cerrar,
las citas de la semana y la ocupación son del presente por definición, y
mirarlas por un periodo pasado daría números que no piden ninguna acción.

El Excel se lleva **el mismo periodo que está en pantalla**: descargar algo
distinto de lo que se está viendo es una sorpresa desagradable. Dos hojas —el
resumen para pegar en un reporte, y el detalle de citas para filtrar por su
cuenta— sin nada clínico: el expediente tiene su propia exportación. Ojo con
el nombre del archivo: `hasta` es el inicio del día siguiente porque el fin es
exclusivo, así que se usa la fecha que eligió el usuario y no esa.

Las tarjetas de "ahora mismo" son ligas: un número que pide acción tiene que
llevar al lugar donde se actúa.

## Primeros pasos

Un tour de flechitas se hace clic para quitárselo de encima y no enseña nada.
`PrimerosPasos` mira el **estado real** —¿hay franjas?, ¿hay bio?, ¿hay
pacientes?, ¿hay más de un miembro?— y cada paso se tacha solo cuando de
verdad está hecho. La lista entera desaparece cuando no queda ninguno.

Cada paso dice **por qué** importa, no solo qué hacer: sin el porqué, "publica
tu horario" es una tarea; con él, es la razón de que tu liga todavía no sirva.

- El aviso suelto de "todavía no defines tu horario" se esconde mientras la
  guía esté visible: ya lo dice, y repetirlo sería decir dos veces lo mismo en
  la misma pantalla.
- "Invita a tu asistente" solo le sale al dueño.
- `onboarding_hidden_at` es para el caso que no se puede deducir: quien ya sabe
  usarla y nunca va a completar algún paso a propósito —un médico que trabaja
  solo y no piensa invitar a nadie.
- La explicación de qué hay en cada sección va plegada dentro de la misma
  tarjeta. Es lo que un tour intentaría contar, sin tapar la pantalla.

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

Recuperar la contraseña (`/recuperar`) sale por Resend con
`admin.generateLink`, no por el SMTP de Supabase: misma plantilla, mismo
remitente, y no depende de un canal que no está configurado. Tres cosas que no
son negociables ahí:

- **La respuesta es siempre la misma**, exista o no la cuenta. Decir "no hay
  nadie con ese correo" dejaría averiguar qué médicos usan CitaPedia probando
  direcciones.
- El correo **no saluda por su nombre** ni menciona el consultorio: quien pide
  recuperar puede no ser el dueño, y no hay por qué confirmarle a un extraño
  de quién es la dirección que tecleó.
- `generateLink` **no pasa por los límites de Supabase**, así que hay un freno
  de 60 segundos por correo. Sin él, cualquiera que sepa el correo de un médico
  puede llenarle el buzón.
- El freno se consulta **antes** de generar (`puede_recuperar`), y esto es lo
  importante: `generateLink` invalida el token anterior en cuanto se llama, así
  que frenar después dejaba muerta la liga ya enviada sin poner otra en su
  lugar. La función contesta lo mismo para un correo inexistente que para uno
  que ya esperó, así que preguntarle no delata a nadie.

La consola de plataforma **no ofrece recuperación**: la operan dos personas
contadas y si alguna se atora se arregla desde Supabase. Sería una puerta más
a la parte más sensible del sistema a cambio de casi nada.

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
  dato dice cómo tratar a esa persona; en **Inicio**, el corte "De dónde
  llegan" responde en qué invertir y a quién agradecerle. Está ahí y no en
  Pacientes porque es una pregunta del consultorio, no de una lista.
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

La ficha se lee en dos columnas con un papel claro cada una: a la **izquierda**
con quién se habla y cuándo se le ve —contacto, próximas citas, avisos
programados—; a la **derecha**, lo que es del paciente: su expediente, sus
estudios y su bitácora.

Cada columna necesita su propio contenedor. Con los hijos sueltos, el grid de
dos columnas los repartía celda por celda y las secciones caían en zigzag
—Estudios bajo Contacto, la bitácora enfrente—: eso era lo que hacía que la
ficha se sintiera desordenada, no la falta de secciones.

En el encabezado va **solo lo que aplica al paciente entero**: agendar y
descargar. Editar es de cada tarjeta —una liga discreta en su esquina—, porque
quien va a corregir un teléfono lo está mirando en Contacto, no en un botón
lejos de ahí. Cuatro botones arriba hacían que ninguno destacara.

La ficha separa **Próximas citas** de la bitácora: una cita que no ha ocurrido
no es una visita con algo anotado ese día, y mezclarlas hacía que la línea de
tiempo del paciente empezara en el futuro. Cuando no hay ninguna agendada pero
el médico dejó dicho que vuelva, ahí sale el control pendiente con su motivo y
el botón para agendarle — es justo a quien hay que llamar, y la ficha es donde
se está mirando.

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

## NOM-004: lo escrito no se altera en silencio

La norma del expediente clínico pide que lo asentado quede íntegro y que cada
nota diga quién y cuándo. `consultation_notes` se reescribía con un `update`:
el médico corregía un diagnóstico y la versión anterior desaparecía. Eso no es
aceptable en un expediente, y tampoco protege al médico — si alguien alega que
"ahí decía otra cosa", no había con qué responder.

**No se bloquea la edición**: corregir es normal y necesario. Lo que cambia es
que cada versión anterior se guarda antes de perderse, en
`consultation_note_history`, por trigger.

- La tabla tiene política de **select y nada más**. Un historial que se puede
  editar no es un historial, y la ausencia de políticas de update y delete es
  la que lo garantiza.
- Guarda lo que decía **antes**, no lo nuevo: lo nuevo ya está en la nota.
- Un `update` que no toca nada clínico no genera versión: llenaría el historial
  de renglones idénticos.
- **Llenar un campo vacío tampoco es corregir.** El médico guarda los signos
  vitales y después la nota, y en el segundo guardado le salía "Se corrigió 1
  vez" con el tratamiento tachado como si lo hubiera borrado. No borró nada. La
  norma pide que lo **asentado** quede íntegro, y un campo vacío no asentó
  nada. Basta que un campo con contenido cambie para guardar la versión entera;
  lo que se salta es solo el caso en que todo lo que cambió venía vacío.
- **En pantalla se listan únicamente los campos que cambiaron**, comparando
  cada versión contra la que vino después (y la más reciente, contra la nota de
  hoy). Listar la versión completa señalaba como borrado lo que nadie tocó, y
  un historial que señala lo que no pasó deja de creerse — junto con los
  renglones que sí importan.
- `historial_de_nota` devuelve **también los signos vitales**. Los guardaba
  pero no los devolvía, así que corregir un peso creaba una versión que en
  pantalla salía vacía: "se corrigió" y ningún campo debajo.
- Borrar la nota también deja constancia (`motivo = 'delete'`).
- Al probarlo: sin política de update, RLS **no lanza error**, simplemente no
  encuentra filas que tocar. Las pruebas verifican el efecto, no esperan una
  excepción que nunca llega.

### Lo recetado, con estructura

`consultation_medications` guarda medicamento, dosis, frecuencia, duración e
indicaciones. **No reemplaza a `treatment`**, que sigue siendo texto libre: el
médico escribe ahí lo que quiera y esto es un agregado opcional. Obligar a
estructurar con el paciente enfrente es cómo un campo deja de llenarse.

Lo que gana es la pregunta que el texto libre no puede contestar: qué se le
dio, cuánto, y a quién más se le recetó lo mismo.

- **Solo el nombre es obligatorio.** Medio dato sirve más que ninguno.
- **La fila no se reescribe.** Un trigger rechaza cualquier cambio que no sea
  el retiro: corregir una receta es retirarla y escribir la correcta, y las dos
  quedan a la vista. Es la misma exigencia de la NOM-004 que llevó al historial
  de notas, resuelta aquí sin una segunda tabla — y por eso el mensaje del
  error lo dice con esas palabras.
- **Retirar no es borrar.** Suspender un medicamento es un hecho clínico:
  `archived_at` lo registra y la lista lo muestra tachado, con su fecha.
- **Solo dueño** (`is_owner`), como la nota: una receta es tan clínica como una
  alergia.

En la ficha va en su propia tarjeta, **separada de `clinical_records.medications`**:
uno es lo que el médico indicó y cuándo, el otro lo que el paciente dice que
toma. Mezclarlos haría imposible saber quién recetó qué. Ahí solo se lista —
recetar es un acto de la consulta y su lugar es el workspace.

En el Excel es la hoja **Recetas**, clínica como las otras dos (el asistente ni
la pide). **Las retiradas no se omiten**, salen marcadas: que un medicamento se
haya suspendido es parte de lo que el expediente tiene que contar. Se llega por
`consultation_notes!inner(patient_id)` porque la receta cuelga de la nota, no
del paciente.

**Nada se borra de verdad.** Cerrar el consultorio ya no hace `delete` —la
cascada se llevaba pacientes, citas, expedientes, notas, estudios y hasta este
mismo historial—: lo archiva. Para el médico el efecto es el mismo (su agenda
se apaga y su página desaparece) pero los datos siguen ahí, y `archived_at` es
la fecha desde la que corren los cinco años. Borrar un estudio también lo
archiva, y el archivo se queda en su lugar.

Archivado y suspendido son cosas distintas con el mismo efecto: uno lo decide
el médico, el otro la plataforma, y cada uno manda a su propia pantalla.

## La receta impresa

El médico sube **su** papel membretado y CitaPedia escribe encima. No se genera
un diseño nuestro, y no es pereza: lo que hace válida una receta en México
—nombre, cédula profesional, domicilio, firma— ya está impreso en su papel, y
la cédula es justo un dato que nadie más que él puede afirmar. CitaPedia no
valida nada de eso; pone los medicamentos en el espacio libre.

- **Sin papel cargado no se imprime.** Una hoja en blanco con dos medicamentos
  parece una receta y no lo es. La ruta contesta 409 y el botón ni aparece.
- **Dos números en vez de un editor de coordenadas.** Una hoja membretada tiene
  el encabezado arriba, la firma abajo y el centro vacío: con "cuánto respetar
  arriba" y "cuánto abajo" en milímetros se acomoda cualquier papel, y el
  médico los mide con una regla sobre su propia hoja.
- **El papel manda el tamaño.** Si su receta es media carta, la nuestra sale de
  media carta: se toma del PDF incrustado. Solo cuando sube una imagen se asume
  carta.
- **Lo que no cabe no se encima.** Al llegar al margen de abajo se deja de
  escribir, porque ahí va su firma. Hay una prueba con márgenes imposibles que
  verifica que no se escriba nada en vez de invadir.
- El bucket `papel-receta` es **privado y de solo dueño**: lleva su cédula y
  muchas veces su firma escaneada. Un asistente que pudiera cambiarlo podría
  imprimir recetas con otro papel.
- El PDF sale `inline` y con `no-store`: lo que se quiere es imprimirlo ahí
  mismo, y lleva datos de salud con nombre.

`pdf-lib` escribe el texto en **hexadecimal** (`<58696D656E61> Tj`, no
`(Ximena) Tj`) y comprime los flujos. Una prueba que busque el texto en los
bytes crudos **pasa sin encontrar nada**, que es la peor forma de fallar; así
empezó `verify-receta` y por eso ahora infla los flujos y decodifica el hex.

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

### Verlos sin bajarlos

`VisorEstudio` abre el archivo en un `<dialog>` con la liga firmada. Bajar un
estudio para mirarlo deja copias del expediente de alguien regadas en la
computadora del consultorio, y en consulta lo que se quiere es verlo ya.

- Las imágenes van con escala (`1, 1.5, 2, 3, 4`) y arrastre para moverse
  dentro del acercamiento. El zoom se actualiza con función
  (`setZoom((actual) => …)`): dos clics rápidos leían el mismo valor de la
  clausura y avanzaban un solo paso.
- Los PDF van en un `<iframe>` y usan el visor del navegador, que ya trae su
  propio zoom. Reimplementarlo pediría traerse un renderizador entero.
- HEIC no lo pinta ningún navegador: en vez de un cuadro roto, dice que hay que
  descargarlo.

## Exportar a Excel

`.xlsx` de verdad, con `write-excel-file`. CSV parece suficiente hasta que
Excel se come el `+` de un teléfono, convierte `5550506060` a notación
científica y rompe los acentos; con datos mexicanos eso pasa siempre. Los
teléfonos van forzados a texto.

El botón pregunta **qué llevarse** (`DescargarExpediente`): datos, citas,
expediente y notas son cuatro casillas, y la ruta las recibe como `?hoja=`
repetido. Sin el parámetro se llevan todas, para que una liga vieja siga
sirviendo. Si el filtro deja todo fuera se devuelve al menos la hoja del
paciente: un `.xlsx` sin hojas no abre. Los estudios no caben en un Excel y se
bajan uno por uno desde su visor; el diálogo lo dice para que no se busquen
adentro.

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
