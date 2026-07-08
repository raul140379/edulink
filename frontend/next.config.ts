const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/dashboard/teacher-tutor',        destination: '/dashboard/plantel-docente',        permanent: true },
      { source: '/dashboard/teacher-tutor/:path*', destination: '/dashboard/plantel-docente/:path*', permanent: true },
      { source: '/dashboard/teacher',              destination: '/dashboard/plantel-docente',        permanent: true },
      { source: '/dashboard/teacher/:path*',       destination: '/dashboard/plantel-docente/:path*', permanent: true },
      { source: '/dashboard/parent',               destination: '/dashboard/padres',                 permanent: true },
      { source: '/dashboard/parent/:path*',        destination: '/dashboard/padres/:path*',           permanent: true },
      { source: '/dashboard/junta',                destination: '/dashboard/padres',                 permanent: true },
      { source: '/dashboard/junta/:path*',         destination: '/dashboard/padres/:path*',           permanent: true },
      { source: '/dashboard/delegate',             destination: '/dashboard/padres',                 permanent: true },
      { source: '/dashboard/delegate/:path*',      destination: '/dashboard/padres/:path*',           permanent: true },
      { source: '/dashboard/secretaria',           destination: '/dashboard/asistencia-kiosco',       permanent: true },
    ]
  },
}

export default nextConfig