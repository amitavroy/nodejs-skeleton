import type { NextConfig } from "next";

const apiPort = process.env.API_PORT ?? "3001";

const config: NextConfig = {
  // The browser calls /api/* on the web origin; Next forwards it to the Hono server (no CORS).
  // Do NOT add Next API routes or server actions: the API lives in apps/server.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `http://localhost:${apiPort}/api/:path*` }];
  },
};

export default config;
