import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { baseDelSitio } from '@/lib/sitio'

// Geométrica y redondeada como el wordmark, pero con números legibles para
// una agenda. Neutra sin ser fría.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  // Para que las imágenes y ligas relativas de Open Graph salgan absolutas:
  // WhatsApp y las redes no resuelven rutas, necesitan la dirección entera.
  metadataBase: new URL(baseDelSitio()),
  title: {
    default: 'CitaPedia — Cuidarlos es primero',
    template: '%s · CitaPedia',
  },
  description:
    'Agenda para consultorios. Tu página pública, tus horarios y tus citas, con cada solicitud aprobada por ti.',
  openGraph: {
    type: 'website',
    siteName: 'CitaPedia',
    locale: 'es_MX',
    title: 'CitaPedia — Cuidarlos es primero',
    description:
      'Agenda para consultorios. Tu página pública, tus horarios y tus citas, con cada solicitud aprobada por ti.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  )
}
