// Sets this template up for a new app.
//
//   npm run init                       interactive: asks for the app name and database details
//   npm run init -- my-app             app name given, asks for the rest
//   npm run init -- --name my-app --db-name my_app --db-user my_app --db-password 's3cret!' --yes
//
// It (1) replaces the app-name placeholder in every file, (2) writes .env from .env.example with
// your database name, user and password, and (3) runs `git init` if there is no repository yet. Run it before `npm install`.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";

// Built from two pieces so this file does not get rewritten by its own replacement pass.
const PLACEHOLDER = "__APP" + "_NAME__";
const root = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "data", "storage"]);
const SKIP_FILES = new Set(["init.mjs"]);

const USAGE = `Usage:
  npm run init                       interactive
  npm run init -- my-app             app name given, asks for the rest
  npm run init -- --name my-app --db-name my_app --db-user my_app --db-password 's3cret!' --yes

Flags: --name, --db-name, --db-user, --db-password, --yes (never prompt; use defaults for anything missing)`;

const identifier =
  "Use lowercase letters, digits and underscores, starting with a letter (max 63 characters).";
const validators = {
  name: (v) =>
    /^[a-z][a-z0-9-]{0,40}$/.test(v)
      ? null
      : "Use lowercase letters, digits and dashes, starting with a letter (e.g. video-magic).",
  dbName: (v) => (/^[a-z_][a-z0-9_]{0,62}$/.test(v) ? null : identifier),
  dbUser: (v) => (/^[a-z_][a-z0-9_]{0,62}$/.test(v) ? null : identifier),
  dbPassword: (v) =>
    v.length >= 6 && /^[^\s#$"'`\\]+$/.test(v)
      ? null
      : "At least 6 characters, with no spaces and none of  # $ \" ' ` \\  (they break .env files).",
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string" },
    "db-name": { type: "string" },
    "db-user": { type: "string" },
    "db-password": { type: "string" },
    yes: { type: "boolean", short: "y", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// --- Guard: only run on a fresh copy of the template -------------------------------------
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.name !== PLACEHOLDER) fail(`This project is already initialised as "${pkg.name}". Nothing to do.`);

// --- Prompting ---------------------------------------------------------------------------
const interactive = Boolean(process.stdin.isTTY) && !values.yes;
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = interactive ? createInterface({ input: process.stdin, output, terminal: true }) : null;

/** Uses the flag value if given, otherwise asks (interactive) or takes the default (scripted). */
async function resolveValue({ flag, label, def, validate, secret = false, hint = "" }) {
  if (flag !== undefined) {
    const error = validate(flag);
    if (error) fail(`${label}: ${error}`);
    return flag;
  }
  if (!interactive) {
    if (def === undefined) fail(`${label} is required: pass it as a flag, or run in a terminal.`);
    return def;
  }
  for (;;) {
    const suffix = def !== undefined ? ` [${hint || def}]` : "";
    let answer;
    if (secret) {
      process.stdout.write(`${label}${suffix}: `);
      muted = true;
      answer = (await rl.question("")).trim();
      muted = false;
      process.stdout.write("\n");
    } else {
      answer = (await rl.question(`${label}${suffix}: `)).trim();
    }
    if (!answer) answer = def;
    if (answer === undefined) {
      console.log("  A value is required.");
      continue;
    }
    const error = validate(answer);
    if (!error) return answer;
    console.log(`  ${error}`);
  }
}

const name = await resolveValue({
  flag: values.name ?? positionals[0],
  label: "App name",
  validate: validators.name,
});
const snake = name.replaceAll("-", "_");
const dbName = await resolveValue({
  flag: values["db-name"],
  label: "Database name",
  def: snake,
  validate: validators.dbName,
});
const dbUser = await resolveValue({
  flag: values["db-user"],
  label: "Database user",
  def: snake,
  validate: validators.dbUser,
});
const generatedPassword = randomBytes(18).toString("base64url");
const dbPassword = await resolveValue({
  flag: values["db-password"],
  label: "Database password",
  def: generatedPassword,
  hint: "press Enter to generate one",
  validate: validators.dbPassword,
  secret: true,
});
const passwordWasGenerated = dbPassword === generatedPassword;

// --- Confirm -----------------------------------------------------------------------------
const envPath = join(root, ".env");
let writeEnv = true;
if (existsSync(envPath)) {
  if (interactive) {
    const a = (await rl.question("A .env file already exists. Overwrite it? [y/N]: ")).trim().toLowerCase();
    writeEnv = a === "y" || a === "yes";
  } else {
    writeEnv = false;
    console.warn("A .env file already exists; leaving it untouched.");
  }
}

if (interactive) {
  console.log(`\nAbout to set up "${name}":`);
  console.log(`  - replace ${PLACEHOLDER} with "${name}" in all files`);
  console.log(
    writeEnv
      ? `  - write .env (database "${dbName}", user "${dbUser}", password ${passwordWasGenerated ? "generated" : "as entered"})`
      : "  - keep your existing .env",
  );
  const a = (await rl.question("Proceed? [Y/n]: ")).trim().toLowerCase();
  if (a === "n" || a === "no") {
    rl.close();
    fail("Cancelled. Nothing was changed.");
  }
}
rl?.close();

// --- Apply -------------------------------------------------------------------------------
let changed = 0;
function replaceInTree(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      replaceInTree(path);
    } else if (!SKIP_FILES.has(entry) && !/\.(png|jpe?g|ico|db)$/.test(entry)) {
      const text = readFileSync(path, "utf8");
      if (text.includes(PLACEHOLDER)) {
        writeFileSync(path, text.replaceAll(PLACEHOLDER, name));
        changed++;
      }
    }
  }
}
replaceInTree(root);

if (writeEnv) {
  const chosen = { DB_NAME: dbName, DB_USER: dbUser, DB_PASSWORD: dbPassword };
  const env = readFileSync(join(root, ".env.example"), "utf8")
    .split("\n")
    .map((line) => {
      // keep any trailing "# comment" from .env.example
      const m = line.match(/^(DB_NAME|DB_USER|DB_PASSWORD)=(\S*)(.*)$/);
      return m ? `${m[1]}=${chosen[m[1]]}${m[3]}` : line;
    })
    .join("\n");
  writeFileSync(envPath, env);
}

if (!existsSync(join(root, ".git"))) execSync("git init -q -b main", { cwd: root });

console.log(`\nDone: "${name}" is set up (${changed} files updated${writeEnv ? ", .env written" : ""}).`);
if (writeEnv && passwordWasGenerated) console.log("The generated database password is DB_PASSWORD in .env.");
console.log("\nNext:\n  npm install\n  make up        # Postgres, Redis, Mailpit, Dozzle\n  npm run dev    # then open http://localhost:3000");
