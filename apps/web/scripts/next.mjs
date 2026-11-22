// Runs `next <dev|build|start>` with the repo-root .env loaded and the port taken from WEB_PORT.
// (Next only reads .env files from its own folder, but this repo keeps one .env at the root.)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const envFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [command = "dev", ...rest] = process.argv.slice(2);
const port = process.env.WEB_PORT ?? "3000";
const args = command === "build" ? [command, ...rest] : [command, "-p", port, ...rest];

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
