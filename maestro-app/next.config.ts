const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Permite abrir el dev server desde el celular por IP de red local — sin
  // esto, Next bloquea (403) sus propios recursos internos (JS/HMR) cuando
  // se piden desde un origen que no reconoce como el suyo.
  allowedDevOrigins: ['192.168.100.202'],
}

export default nextConfig
