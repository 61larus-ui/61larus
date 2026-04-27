import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__larus_ingest/api/:path*",
        destination: "https://61larus.com/api/:path*",
      },
      {
        source: "/__larus_ingest/entry/:id",
        destination: "https://61larus.com/:id",
      },
    ];
  },
};

export default nextConfig;
