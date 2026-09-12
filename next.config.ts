import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Hay un package-lock.json en el home del usuario; sin esto Turbopack
  // sube demasiado buscando la raíz del proyecto.
  turbopack: { root: __dirname },

  experimental: {
    serverActions: {
      // El límite por defecto es 1 MB y la foto de perfil admite 5. Una foto
      // de celular pesa dos o tres, así que el cuerpo se rechazaba ANTES de
      // entrar a la acción: el médico veía una pantalla de error con un código
      // en vez del mensaje de "la foto pesa 7 MB". Va un poco arriba del tope
      // real para que quien decida sea nuestra validación, no el framework.
      bodySizeLimit: '6mb',
    },
  },
}

export default nextConfig
