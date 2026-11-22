// Usage: npm run init -- <project-name>
// Replaces the __APP_NAME__ placeholder, creates .env, and starts a fresh git repo.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("Usage: npm run init -- <project-name>   (lowercase letters, digits, dashes)");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const skip = new Set(["node_modules", ".git", "dist", "data"]);
let changed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (!/\.(png|jpg|ico|db)$/.test(entry) && entry !== "package-lock.json") {
      const text = readFileSync(path, "utf8");
      if (text.includes("__APP_NAME__")) {
        writeFileSync(path, text.replaceAll("__APP_NAME__", name));
        changed++;
      }
    }
  }
}
walk(root);

if (!existsSync(join(root, ".env"))) copyFileSync(join(root, ".env.example"), join(root, ".env"));

const lock = join(root, "package-lock.json");
if (existsSync(lock)) writeFileSync(lock, readFileSync(lock, "utf8").replaceAll("__APP_NAME__", name));

if (!existsSync(join(root, ".git"))) {
  execSync("git init -q", { cwd: root });
}
console.log(`Initialised "${name}" (${changed} files updated). Next: npm install && npm run dev`);
