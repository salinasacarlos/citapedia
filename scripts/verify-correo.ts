/**
 * Pruebas del armado del recordatorio. Sin base ni red: funciones puras.
 *   npm run test:correo
 */
import { armarRecordatorio, correoParaAvisar } from '../src/lib/correo/recordatorio'
import { armarInvitacion } from '../src/lib/correo/invitacion'
import { traducirResend } from '../src/lib/correo/enviar'
import { armarCitaAceptada } from '../src/lib/correo/cita-aceptada'

let fallos = 0
function check(etiqueta: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${etiqueta}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

const MX = 'America/Mexico_City'
const PLANTILLA =
  'Hola {paciente}, te recordamos tu cita con {doctor} el {fecha} a las {hora}.'

console.log('\nA quién se le escribe')

check(
  'a un adulto, a su propio correo',
  correoParaAvisar({
    name: 'Carlos Salinas',
    email: 'carlos@example.com',
    is_minor: false,
    tutor_name: null,
    tutor_email: null,
  })?.correo === 'carlos@example.com',
)

const deMenor = correoParaAvisar({
  name: 'Ximena Robles',
  email: null,
  is_minor: true,
  tutor_name: 'Adriana Robles',
  tutor_email: 'adriana@example.com',
})
check('a un menor, a su tutor', deMenor?.correo === 'adriana@example.com')
check('y el saludo es para el tutor', deMenor?.nombre === 'Adriana Robles')

check(
  'un tutor_name viejo en un adulto no le roba el correo',
  correoParaAvisar({
    name: 'Carlos Salinas',
    email: 'carlos@example.com',
    is_minor: false,
    tutor_name: 'Alguien',
    tutor_email: 'alguien@example.com',
  })?.correo === 'carlos@example.com',
)

check(
  'sin ningún correo no se manda nada',
  correoParaAvisar({
    name: 'Sin Correo',
    email: null,
    is_minor: false,
    tutor_name: null,
    tutor_email: null,
  }) === null,
)

console.log('\nEl correo del adulto')

const adulto = armarRecordatorio({
  destinatario: { nombre: 'Carlos Salinas', correo: 'carlos@example.com' },
  paciente: 'Carlos Salinas',
  esMenor: false,
  doctor: 'Dr. Ernesto Peña',
  direccion: 'Av. Universidad 900, CDMX',
  telefono: '+52 55 8899 1122',
  inicio: '2026-09-01T16:00:00Z', // 10:00 en CDMX
  zona: MX,
  plantilla: PLANTILLA,
  liga: 'https://citapedia.vercel.app/cita/abc123',
})

check('va al correo del paciente', adulto.para === 'carlos@example.com')
check('el asunto dice que es suya', adulto.asunto.includes('tu cita'), adulto.asunto)
check(
  'la hora sale en la zona del consultorio, no en UTC',
  adulto.texto.includes('10:00 a.m.'),
  adulto.texto.split('\n').find((l) => l.includes('10:00')) ?? 'no aparece',
)
check('saluda por su nombre de pila, una sola vez', adulto.texto.startsWith('Hola Carlos,'))
check('la liga va completa', adulto.texto.includes('https://citapedia.vercel.app/cita/abc123'))
check('la liga también va en el HTML', adulto.html.includes('href="https://citapedia.vercel.app/cita/abc123"'))
check('trae la dirección del consultorio', adulto.texto.includes('Av. Universidad 900'))
check(
  'no queda ningún hueco de plantilla sin rellenar',
  !adulto.texto.includes('{') && !adulto.html.includes('{paciente}'),
)

console.log('\nEl correo de un menor')

const menor = armarRecordatorio({
  destinatario: { nombre: 'Adriana Robles', correo: 'adriana@example.com' },
  paciente: 'Ximena Robles',
  esMenor: true,
  doctor: 'Dr. Ernesto Peña',
  direccion: null,
  telefono: null,
  inicio: '2026-09-01T16:00:00Z',
  zona: MX,
  plantilla: PLANTILLA,
  liga: 'https://citapedia.vercel.app/cita/xyz',
})

check('le llega al tutor', menor.para === 'adriana@example.com')
check('la plantilla saluda al tutor, no al menor', menor.texto.startsWith('Hola Adriana,'))
check(
  'y no queda un segundo saludo al paciente',
  !menor.texto.includes('Hola Ximena'),
)
check(
  'pero dice de quién es la cita',
  menor.texto.includes('La cita de Ximena Robles'),
)
check(
  'y el asunto también',
  menor.asunto.includes('cita de Ximena Robles'),
  menor.asunto,
)

console.log('\nDetalles que ya se rompieron antes')

const conComillas = armarRecordatorio({
  destinatario: { nombre: 'Ana <script>', correo: 'a@example.com' },
  paciente: 'Ana <script>alert(1)</script>',
  esMenor: false,
  doctor: 'Dr. "Comillas" & Cía',
  direccion: null,
  telefono: null,
  inicio: '2026-09-01T16:00:00Z',
  zona: MX,
  plantilla: PLANTILLA,
  liga: 'https://citapedia.vercel.app/cita/x',
})
check(
  'el HTML escapa lo que escribió el paciente',
  !conComillas.html.includes('<script>alert(1)</script>'),
)
check('y también los & del nombre del médico', conComillas.html.includes('&amp;'))

const tokio = armarRecordatorio({
  destinatario: { nombre: 'Yuki', correo: 'y@example.com' },
  paciente: 'Yuki',
  esMenor: false,
  doctor: 'Dra. Tanaka',
  direccion: null,
  telefono: null,
  inicio: '2026-09-01T16:00:00Z',
  zona: 'Asia/Tokyo',
  plantilla: PLANTILLA,
  liga: 'https://citapedia.vercel.app/cita/x',
})
check(
  'otra zona horaria da otra hora, no la del servidor',
  tokio.texto.includes('1:00 a.m.'),
  tokio.texto.split('\n').find((l) => l.includes(':00')) ?? '',
)

console.log('\nLa invitación al asistente')

const invita = armarInvitacion({
  para: 'asistente@example.com',
  consultorio: 'Dr. Ernesto Peña',
  liga: 'https://citapedia.vercel.app/invitacion/tok123',
  dias: 7,
})

check('va al correo invitado', invita.para === 'asistente@example.com')
check('el asunto nombra al consultorio', invita.asunto.includes('Dr. Ernesto Peña'))
check('la liga va completa en el texto', invita.texto.includes('/invitacion/tok123'))
check('y en el HTML', invita.html.includes('href="https://citapedia.vercel.app/invitacion/tok123"'))
check('dice cuánto dura', invita.texto.includes('7 días'))
check(
  'avisa que el expediente no se comparte',
  // El HTML va con saltos de línea: se compara sin espacios de más.
  invita.html.replace(/\s+/g, ' ').includes('expediente clínico se queda con el médico'),
)
check(
  'la contraseña la elige quien recibe, nunca se manda una',
  invita.texto.includes('eliges tu propia contraseña') &&
    !/contraseña (temporal|provisional|es:)/i.test(invita.texto),
)

const conMarcas = armarInvitacion({
  para: 'a@example.com',
  consultorio: 'Clínica <b>Norte</b> & Asociados',
  liga: 'https://x/invitacion/t',
  dias: 7,
})
check('escapa el nombre del consultorio', !conMarcas.html.includes('<b>Norte</b>'))

console.log('\nEl aviso de cita aceptada')

const aceptada = armarCitaAceptada({
  destinatario: { nombre: 'Adriana Robles', correo: 'adriana@example.com' },
  paciente: 'Ximena Robles',
  esMenor: true,
  doctor: 'Dr. Ernesto Peña',
  direccion: 'Av. Universidad 900, CDMX',
  telefono: '+52 55 8899 1122',
  inicio: '2026-09-01T16:00:00Z',
  zona: MX,
  liga: 'https://citapedia.vercel.app/cita/tok',
})

check('le llega al tutor', aceptada.para === 'adriana@example.com')
check('lo saluda a él', aceptada.texto.startsWith('Hola Adriana,'))
check('pero dice de quién es la cita', aceptada.texto.includes('La cita de Ximena Robles'))
check('la hora va en la zona del consultorio', aceptada.texto.includes('10:00 a.m.'))
check('pide confirmar, que es a lo que viene', aceptada.html.includes('Confirmar que voy a ir'))
check('lleva la liga', aceptada.html.includes('href="https://citapedia.vercel.app/cita/tok"'))
check(
  'y dice que desde ahí también se mueve o se cancela',
  aceptada.html.includes('moverla o avisarnos'),
)

const aceptadaAdulto = armarCitaAceptada({
  destinatario: { nombre: 'Carlos Salinas', correo: 'c@example.com' },
  paciente: 'Carlos Salinas',
  esMenor: false,
  doctor: 'Dra. Lucía Ferrer',
  direccion: null,
  telefono: null,
  inicio: '2026-09-01T16:00:00Z',
  zona: MX,
  liga: 'https://x/cita/t',
})
check('para un adulto el asunto habla de "Tu cita"', aceptadaAdulto.asunto.startsWith('Tu cita'))
check('y no inventa dirección cuando no hay', !aceptadaAdulto.texto.includes('Dirección:'))

console.log('\nLo que se le dice al médico cuando falla el envío')

check(
  'el error del dominio sin verificar sale en español',
  traducirResend('You can only send testing emails to your own email address').includes(
    'dominio verificado',
  ),
)
check(
  'y el de la llave inválida también',
  traducirResend('API key is invalid').includes('llave de Resend'),
)
check(
  'un error que no conocemos se pasa tal cual, no se traga',
  traducirResend('algo raro') === 'algo raro',
)

console.log(
  fallos === 0 ? '\n✅ Correos verificados.\n' : `\n❌ ${fallos} fallo(s).\n`,
)
process.exit(fallos === 0 ? 0 : 1)
