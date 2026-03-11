/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'puppeteer'];
    }
    return config;
  },
};

module.exports = nextConfig;
