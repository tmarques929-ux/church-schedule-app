const createNextIntlPlugin = require("next-intl/plugin");
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: require("next-pwa/cache"),
  fallbacks: {
    document: "/offline"
  }
});
const withNextIntl = createNextIntlPlugin("./next-intl.config.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cacheComponents: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  turbopack: {
    root: __dirname
  }
};

module.exports = withNextIntl(withPWA(nextConfig));
