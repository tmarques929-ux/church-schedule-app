/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Habilita cache de componentes no App Router (Next 16)
    cacheComponents: true,
    // Adopta Partial Prerendering com habilitacao incremental por rota
    ppr: "incremental"
  },
  eslint: {
    // Nao quebra o build por erro de ESLint
    ignoreDuringBuilds: true
  },
  typescript: {
    // Nao quebra o build por erro de TypeScript
    ignoreBuildErrors: true
  },
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
