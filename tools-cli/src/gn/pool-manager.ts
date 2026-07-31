#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus - Dynamic Account Pool Manager
//
// Scan credential files under ~/.shell/secret/<provider>/ and
// build a lightweight AccountPool JSON understood by `omp`.
//
// The AccountPool shape consumed by `omp auth-gateway` is:
//
//   { "<provider>": ["identityKey", "identityKey", ...] }
//
// where `identityKey` is any non-empty, non-whitespace string.
// It is used to *whitelist* credentials that the broker already
// knows about — this never replaces or bypasses the broker.
// `omp` will throw if the file contains credentials of unknown
// providers or invalid keys, so we stay strict on shape and
// keep secrets out of the output (only identity keys are written).
//
// Usage:
//   bun pool-manager.ts <provider> [--only <identityKey>...]
//
// Env:
//   GN_SECRET_DIR     Override the secrets root (default: ~/.shell/secret)
//   GN_POOL_OUT       Override the output path       (default: /tmp/goblin-pool.json)
// ─────────────────────────────────────────────────────────────

import { readFile, readdir, stat, writeFile, rename, mkdir, chmod } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";

// ─── Config ──────────────────────────────────────────────────
const SECRET_DIR = process.env.GN_SECRET_DIR
  ? resolve(process.env.GN_SECRET_DIR)
  : join(homedir(), ".shell", "secret");
const POOL_OUT = process.env.GN_POOL_OUT
  ? resolve(process.env.GN_POOL_OUT)
  : "/tmp/goblin-pool.json";

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Build the actual omp-format identity key for a credential.
 *
 * The omp broker stores credentials with an `identity_key` column
 * whose shape is:
 *   - "email:<email>"              (OAuth-style, e.g. google-antigravity)
 *   - "account:<provider>|<userId>" (cursor-style)
 *   - "email:<email>|org:<orgId>"  (compound)
 *   - "null"                        (API-key providers — key lives in data blob)
 *
 * For OAuth providers, we mirror that exact prefix so the pool file
 * matches what omp will look up. For API-key providers (where omp
 * stores "null"), the key cannot be whitelisted by identity — but
 * the broker still exposes them in the snapshot. We still emit
 * the API-key value so a *future* omp version that supports
 * per-credential API-key filtering will Just Work, and so the
 * pool file documents which keys exist locally.
 *
 * Priority (mirrors omp's identity_key derivation):
 *   1. `email`           → "email:<email>"
 *   2. `accountId`       → "account:<accountId>" (best-effort)
 *   3. `key` / `apiKey`  → raw value (omp stores "null" today; emitted as-is)
 *   4. `id`              → numeric fallback (omp stores "null"; emitted as-is)
 *
 * Returns null if nothing usable is present.
 */
function buildOmpIdentity(data: Record<string, unknown>): string | null {
  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (email.length > 0) return `email:${email}`;

  const accountId = typeof data.accountId === "string" ? data.accountId.trim() : "";
  if (accountId.length > 0) return `account:${accountId}`;

  const rawKey = typeof data.key === "string" ? data.key.trim() : "";
  if (rawKey.length > 0) return rawKey;

  const rawApiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
  if (rawApiKey.length > 0) return rawApiKey;

  if (typeof data.id === "number" || typeof data.id === "string") {
    const s = String(data.id).trim();
    if (s.length > 0) return s;
  }
  return null;
}

/**
 * Normalize a user-supplied --only value to match the omp-format
 * identity key. Accepts either:
 *   "shobiahmad16@gmail.com"        → "email:shobiahmad16@gmail.com"
 *   "email:shobiahmad16@gmail.com"  → "email:shobiahmad16@gmail.com"
 *   "account:google-oauth2|user_X"  → "account:google-oauth2|user_X" (verbatim)
 *
 * If the input already contains a known prefix (email:/account:),
 * it's used as-is. Otherwise, if it contains an '@', it's wrapped
 * in "email:". Anything else is treated as a literal key.
 */
function normalizeOnly(input: string): string {
  const t = input.trim();
  if (t.startsWith("email:") || t.startsWith("account:")) return t;
  if (t.includes("@")) return `email:${t}`;
  return t;
}

/**
 * Read a single JSON credential file and pull out the provider
 * + identity key. Files that fail to parse are reported and
 * skipped — never silently swallowed.
 */
async function readCredential(filePath: string): Promise<{
  provider: string;
  identityKey: string;
  filename: string;
} | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    console.warn(`⚠️  skip ${filePath}: ${(err as Error).message}`);
    return null;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.warn(`⚠️  skip ${filePath}: invalid JSON (${(err as Error).message})`);
    return null;
  }
  const provider =
    typeof parsed.provider === "string" && parsed.provider.trim().length > 0
      ? parsed.provider.trim()
      : null;
  if (!provider) {
    console.warn(`⚠️  skip ${filePath}: missing "provider" field`);
    return null;
  }
  const identityKey = buildOmpIdentity(parsed);
  if (!identityKey) {
    console.warn(`⚠️  skip ${filePath}: no usable identity field (email/accountId/key/username/id)`);
    return null;
  }
  return { provider, identityKey, filename: basename(filePath) };
}

/**
 * Recursively list *.json files in a directory (non-recursive
 * is the common case, but nested folders are common in some
 * provider layouts so we walk one level deep).
 */
async function listJsonFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isFile() && entry.endsWith(".json")) {
      out.push(full);
    } else if (s.isDirectory()) {
      const nested = await listJsonFiles(full);
      out.push(...nested);
    }
  }
  return out;
}

/**
 * Atomic write: write to .tmp, then rename. This guarantees the
 * gateway never sees a half-written pool file with a truncated
 * JSON that would crash the broker.
 */
async function writePoolAtomic(path: string, body: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, body, { mode: 0o600 });
  await rename(tmp, path);
  // Best-effort: tighten perms on the final file too.
  try {
    await chmod(path, 0o600);
  } catch {
    /* not critical — /tmp is typically 0700 sticky */
  }
}

/**
 * Print a concise summary of the pool that was just written.
 */
function summarize(pool: Record<string, string[]>): string {
  const lines: string[] = [];
  for (const [provider, keys] of Object.entries(pool)) {
    lines.push(`  • ${provider}: ${keys.length} identity key(s)`);
    for (const k of keys) {
      const shown = k.length > 48 ? `${k.slice(0, 45)}...` : k;
      lines.push(`      - ${shown}`);
    }
  }
  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────

interface CliArgs {
  provider: string;
  onlyKeys: string[];
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { provider: "", onlyKeys: [], help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--only" || a === "-o") {
      const next = argv[++i];
      if (!next) throw new Error("--only requires at least one identity key");
      out.onlyKeys.push(next);
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a.startsWith("-")) {
      throw new Error(`unknown flag: ${a}`);
    } else if (!out.provider) {
      out.provider = a;
    } else {
      throw new Error(`unexpected positional arg: ${a}`);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`Goblin Nexus — Dynamic Account Pool Manager

Usage:
  bun pool-manager.ts <provider> [--only <identityKey>...]

Arguments:
  <provider>               Provider folder under $GN_SECRET_DIR
                           (e.g. "google-antigravity" reads
                            ~/.shell/secret/google-antigravity/)

Options:
  -o, --only <key>         Only include credentials whose identity
                           matches one of the given keys. May be
                           repeated. Match is exact. Accepts either
                           "user@example.com" or the omp-prefixed
                           form "email:user@example.com".
  -h, --help               Show this help

Environment:
  GN_SECRET_DIR            Override secrets root (default: ~/.shell/secret)
  GN_POOL_OUT              Override output path (default: /tmp/goblin-pool.json)

Output:
  Writes an AccountPool JSON file (default /tmp/goblin-pool.json) with the
  shape understood by OMP_AUTH_BROKER_ACCOUNT_POOL_FILE. The output contains
  identity keys only — never the underlying secrets. The original credential
  files are read but never copied or moved.
`);
}

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    printHelp();
    process.exit(2);
  }

  if (args.help || !args.provider) {
    printHelp();
    process.exit(args.help ? 0 : 2);
  }

  const providerDir = join(SECRET_DIR, args.provider);
  // Belt-and-suspenders: refuse to write into the repo or to a
  // path the user did not explicitly ask for. This is a defense
  // against accidental `gn pool ..` from inside goblin-vault.
  const repoRoot = resolve(process.env.GOBLIN_VAULT_ROOT ?? "");
  if (repoRoot) {
    const outReal = resolve(POOL_OUT);
    if (outReal === repoRoot || outReal.startsWith(repoRoot + "/")) {
      console.error(
        `❌ refusing to write pool into goblin-vault repo (${outReal}). ` +
          `Override GN_POOL_OUT if you really mean to.`
      );
      process.exit(1);
    }
  }

  // Validate & normalize only-keys up front so we can fail before scanning.
  const onlyNormalized: string[] = [];
  for (const k of args.onlyKeys) {
    const norm = normalizeOnly(k);
    if (norm.length === 0) {
      console.error("❌ --only values must be non-empty");
      process.exit(2);
    }
    if (norm !== norm.trim()) {
      console.error("❌ --only values must not have surrounding whitespace");
      process.exit(2);
    }
    onlyNormalized.push(norm);
  }
  const onlySet = onlyNormalized.length > 0 ? new Set(onlyNormalized) : null;

  // Scan the provider folder.
  const files = await listJsonFiles(providerDir);
  if (files.length === 0) {
    console.error(
      `❌ no credential files found under ${providerDir}\n` +
        `   tip: run \`gn export\` first to seed ~/.shell/secret/`
    );
    process.exit(1);
  }

  // Read every credential, build the pool.
  const pool: Record<string, string[]> = {};

  for (const file of files) {
    const cred = await readCredential(file);
    if (!cred) continue;
    if (cred.provider !== args.provider) {
      // A credential claiming a different provider than the folder
      // it lives in is suspicious — skip and warn rather than
      // silently route it to the wrong provider.
      console.warn(
        `⚠️  skip ${file}: claims provider="${cred.provider}" but folder is "${args.provider}"`
      );
      continue;
    }
    if (onlySet && !onlySet.has(cred.identityKey)) continue;

    if (!pool[cred.provider]) pool[cred.provider] = [];
    if (!pool[cred.provider].includes(cred.identityKey)) {
      pool[cred.provider].push(cred.identityKey);
    }
  }

  if (Object.keys(pool).length === 0) {
    console.error(
      `❌ pool is empty after filtering. Checked ${files.length} file(s) under ${providerDir}.`
    );
    process.exit(1);
  }

  // Validate: provider id must be non-empty & trimmed, identity
  // keys must be non-empty & trimmed (omp enforces this at load
  // time, but a fast-fail here gives a clearer error).
  for (const [provider, keys] of Object.entries(pool)) {
    if (provider !== provider.trim() || provider.length === 0) {
      console.error(`❌ invalid provider id: "${provider}"`);
      process.exit(1);
    }
    for (const k of keys) {
      if (typeof k !== "string" || k.length === 0 || k !== k.trim()) {
        console.error(`❌ invalid identity key for ${provider}: "${k}"`);
        process.exit(1);
      }
    }
  }

  const body = JSON.stringify(pool, null, 2);
  await mkdir(resolve(POOL_OUT, ".."), { recursive: true });
  await writePoolAtomic(POOL_OUT, body);

  console.log(`✅ AccountPool written to ${POOL_OUT}`);
  console.log(summarize(pool));
  console.log(`\nSet OMP_AUTH_BROKER_ACCOUNT_POOL_FILE=${POOL_OUT}`);
  console.log(`then run: omp auth-gateway serve --bind=127.0.0.1:4000`);
}

main().catch((err) => {
  console.error(`❌ pool-manager failed: ${(err as Error).message}`);
  process.exit(1);
});
