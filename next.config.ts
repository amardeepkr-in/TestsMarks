import type { NextConfig } from "next";

// Packages that must stay in Node.js require() and never be bundled by webpack.
// Includes native addons, heavy Node-only libs, and Sentry's OTel instrumentation.
const NODE_EXTERNALS = [
  "better-sqlite3",
  "winston",
  "pdfkit",
  "exceljs",
  "ioredis",
  "@sentry/node",
  "@opentelemetry/instrumentation",
  "require-in-the-middle",
  "import-in-the-middle",
];

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway deployment (smaller image)
  output: 'standalone',

  // Prevents webpack from bundling these in App Router Server Components
  serverExternalPackages: NODE_EXTERNALS,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Compress responses
  compress: true,

  // Extend webpack config to also externalise these for Server Actions
  // (server actions are bundled via next-flight-action-entry-loader, which
  // does NOT use serverExternalPackages automatically in all Next.js 15 builds)
  webpack(config, { isServer }) {
    if (isServer) {
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        ...existingExternals,
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && NODE_EXTERNALS.some((pkg) => request === pkg || request.startsWith(pkg + "/"))) {
            return callback(null, "commonjs " + request);
          }
          callback();
        },
      ];
    }
    return config;
  },

  // Security headers (also set in middleware)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
