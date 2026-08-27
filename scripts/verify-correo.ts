/**
 * Pruebas del armado del recordatorio. Sin base ni red: funciones puras.
 *   npm run test:correo
 */
import { armarRecordatorio, correoParaAvisar } from '../src/lib/correo/recordatorio'

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

console.log(
  fallos === 0 ? '\n✅ Recordatorios verificados.\n' : `\n❌ ${fallos} fallo(s).\n`,
)
process.exit(fallos === 0 ? 0 : 1)
