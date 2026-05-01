import type { NextConfig } from "next";

const canonicalHost = "https://61sozluk.com";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "61larus.com",
          },
        ],
        destination: `${canonicalHost}/:path*`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/__larus_ingest/api/:path*",
        destination: `${canonicalHost}/api/:path*`,
      },
      {
        source: "/__larus_ingest/entry/:id",
        destination: `${canonicalHost}/:id`,
      },
    ];
  },
};

export default nextConfig;
