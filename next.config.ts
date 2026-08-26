import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Hay un package-lock.json en el home del usuario; sin esto Turbopack
  // sube demasiado buscando la raíz del proyecto.
  turbopack: { root: __dirname },
}

export default nextConfig
