import { ImageResponse } from 'next/og'
import { cargarPaginaPublica } from '@/lib/publico/datos'
import { dominioPublico } from '@/lib/sitio'
import { nombreDePila } from '@/lib/fechas'
import { enTextoPlano } from '@/lib/texto-rico'

/**
 * La tarjeta que sale al pegar la liga del médico en WhatsApp.
 *
 * Se dibuja aquí en vez de pedir una imagen al médico: la liga se comparte
 * desde el primer día, mucho antes de que nadie suba un diseño, y una liga sin
 * vista previa se ve como las que uno no abre.
 */
export const alt = 'Página del consultorio en CitaPedia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Imagen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const datos = await cargarPaginaPublica(slug)
  const perfil = datos?.perfil

  const nombre = perfil?.name ?? 'CitaPedia'
  const inicial = nombreDePila(nombre).charAt(0).toUpperCase()
  // Corto: en la tarjeta de WhatsApp compite con el nombre, no lo acompaña.
  const resumen = perfil?.bio ? enTextoPlano(perfil.bio, 120) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#fbfcfd',
          // Los colores van literales: esto se dibuja fuera del navegador, sin
          // hoja de estilos ni variables de la marca.
          color: '#12284a',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {perfil?.photo_url ? (
            <img
              src={perfil.photo_url}
              alt=""
              width={200}
              height={200}
              style={{ width: 200, height: 200, borderRadius: 48, objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 48,
                background: '#d7f5ef',
                color: '#0fb39a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 96,
                fontWeight: 700,
              }}
            >
              {inicial}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 800 }}>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{nombre}</div>
            {perfil?.specialty && (
              <div style={{ fontSize: 40, color: '#5b6b84', marginTop: 12 }}>
                {perfil.specialty}
              </div>
            )}
          </div>
        </div>

        {resumen && (
          <div style={{ display: 'flex', fontSize: 32, color: '#5b6b84', lineHeight: 1.4 }}>
            {resumen}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 36, color: '#0fb39a', fontWeight: 600 }}>
            Agenda tu cita en línea
          </div>
          {/* Un solo hijo de texto: satori exige display:flex en cuanto hay
              más de uno, y `{a}/{b}` son tres nodos. */}
          <div style={{ fontSize: 32, color: '#5b6b84' }}>{`${dominioPublico()}/${slug}`}</div>
        </div>
      </div>
    ),
    size,
  )
}
