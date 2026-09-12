// Una variable mal puesta no se ve al ponerla: se ve cuando un médico abre su
// liga y le contesta otro servidor. Estos son los valores que ya se colaron.

import { problemaDelSitio, dominioPublico } from '../src/lib/sitio'

const casos: [string | undefined, boolean][] = [
  ['https://www.citapedia.com', false],
  ['https://citapedia.vercel.app', false],
  ['https://citapedia.com', false],
  ['http://localhost:3000', false],
  ['https://dhmqhmzjbvqfoosdkzcm.supabase.co', true],
  ['dhmqhmzjbvqfoosdkzcm.supabase.co', true],
  ['www.citapedia.com', true],
  ['', true],
  [undefined, true],
]

let fallas = 0
for (const [valor, debeFallar] of casos) {
  if (valor === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = valor
  const problema = problemaDelSitio()
  const ok = Boolean(problema) === debeFallar
  if (!ok) fallas++
  console.log(
    `${ok ? 'ok  ' : 'MAL '} ${JSON.stringify(valor)} → ${problema ?? 'sin problema'}`,
  )
}

process.env.NEXT_PUBLIC_SITE_URL = 'https://www.citapedia.com'
console.log('dominio mostrado:', dominioPublico())
console.log(fallas === 0 ? '\n✅ Sitio verificado.' : `\n❌ ${fallas} casos mal.`)
process.exit(fallas === 0 ? 0 : 1)
