/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust proxy headers when behind reverse proxy
  // This allows Next.js to correctly handle X-Forwarded-* headers
  experimental: {
    // Enable proper handling of proxy headers
  },
  // Ensure proper handling of forwarded headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

