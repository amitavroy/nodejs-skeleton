import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS DI needs decorator metadata, which esbuild does not emit: compile with SWC instead.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  // Each test boots a Nest app on a fresh PGlite database (~1s, ~4s cold): the 5s default is too tight.
  test: { include: ["test/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 },
});
