/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Não quebra o build por erro de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Não quebra o build por erro de TypeScript
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
