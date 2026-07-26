#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus - Token & Cost Burn Tracker
//
// Memanggil REST endpoint OMP Broker v17.1.4:
//   GET /v1/usage/clients  -> token burn per client (input/output/cache/cost)
//   GET /v1/usage/history  -> time-series untuk sparkline
//
// Fallback / enrichment:
//   `omp usage --json`     -> capacity summary, disabledCredentials, accounts
//
// Env:
//   OMP_AUTH_BROKER_URL   Default: http://127.0.0.1:4001 (fallback 4000)
//   OMP_AUTH_BROKER_TOKEN Bearer token. Jika kosong, baca dari
//                         $HOME/.omp/auth-broker.token
//
// Flags:
//   --history             Tampilkan sparkline history (per provider)
//   --json                Output JSON mentah (no pretty table)
//   --days <int>          Window history dalam hari (default: 7)
//   --provider <id>       Filter 1 provider (mis. google-antigravity)
//   -h, --help            Tampilkan bantuan singkat
// ─────────────────────────────────────────────────────────────

import { argv, env, exit, stderr, stdout } from "node:process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Config ──────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

interface CliArgs {
  history: boolean;
  json: boolean;
  days: number;
  provider: string | null;
  help: boolean;
}

const SPARK = "▁▂▃▄▅▆▇█";
const DEFAULT_BROKER_PORTS = [4001, 4000];
const REQUEST_TIMEOUT_MS = 8_000;

// ─── CLI parsing ──────────────────────────────────────────────

function parseArgs(): CliArgs {
  const out: CliArgs = {
    history: false,
    json: false,
    days: 7,
    provider: null,
    help: false,
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--history") out.history = true;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--days" && args[i + 1]) {
      const n = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(n) && n > 0) out.days = n;
      i++;
    } else if (a === "--provider" && args[i + 1]) {
      out.provider = args[i + 1];
      i++;
    } else if (a.startsWith("--")) {
      stderr.write(`⚠️  Unknown flag ignored: ${a}\n`);
    } else if (!out.provider) {
      out.provider = a;
    }
  }
  return out;
}

function printHelp(): void {
  stdout.write(`🔥 gn burn — Token & Cost Burn Tracker

Usage: gn burn [flags]

Flags:
  --history             Tampilkan sparkline history per provider
  --json                Output JSON mentah, no pretty table
  --days <int>          Window history (default: 7)
  --provider <id>       Filter 1 provider (mis. google-antigravity)
  -h, --help            Tampilkan bantuan ini

Env:
  OMP_AUTH_BROKER_URL   Default: http://127.0.0.1:4001 (fallback 4000)
  OMP_AUTH_BROKER_TOKEN Bearer token. Default: $HOME/.omp/auth-broker.token
`);
}

// ─── Broker discovery ─────────────────────────────────────────

async function resolveBroker(): Promise<{ url: string; token: string | null }> {
  let token: string | null = env.OMP_AUTH_BROKER_TOKEN || null;
  if (!token) {
    try {
      token = (await readFile(join(homedir(), ".omp", "auth-broker.token"), "utf8")).trim();
    } catch {
      token = null;
    }
  }

  // Prefer explicit env override
  const explicit = env.OMP_AUTH_BROKER_URL?.trim();
  if (explicit) return { url: explicit.replace(/\/+$/, ""), token };

  // Try default ports in order
  for (const port of DEFAULT_BROKER_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    const ok = await pingBroker(url, token);
    if (ok) return { url, token };
  }
  // Return the primary default even if ping failed; caller surfaces error
  return { url: `http://127.0.0.1:${DEFAULT_BROKER_PORTS[0]}`, token };
}

async function pingBroker(url: string, token: string | null): Promise<boolean> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 1500);
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${url}/health`, { headers, signal: ctrl.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(to);
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────

async function fetchJson<T>(url: string, token: string | null): Promise<T | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) {
      stderr.write(`⚠️  ${url} -> HTTP ${res.status}\n`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    stderr.write(`⚠️  ${url} -> ${(err as Error).message}\n`);
    return null;
  } finally {
    clearTimeout(to);
  }
}

// ─── OMP usage JSON fallback ──────────────────────────────────

async function fetchOmpUsage(provider: string | null): Promise<AnyRecord | null> {
  const args = ["usage", "--json"];
  if (provider) args.push(`--provider=${provider}`);
  try {
    const proc = Bun.spawn({
      cmd: ["omp", ...args],
      env: { ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      stderr.write(`⚠️  omp usage --json exited ${code}: ${err.slice(0, 200)}\n`);
      return null;
    }
    return JSON.parse(out) as AnyRecord;
  } catch (err) {
    stderr.write(`⚠️  omp usage --json failed: ${(err as Error).message}\n`);
    return null;
  }
}

// ─── Token/cost math (USD) ────────────────────────────────────
// Rough per-1k-token pricing when broker does not provide cost fields yet.
// These are intentionally conservative defaults used only when broker omits cost.

const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  "google-antigravity": { in: 0, out: 0 },
  "openai-codex": { in: 0.003, out: 0.012 },
  "anthropic": { in: 0.003, out: 0.015 },
  "github-copilot": { in: 0, out: 0 },
  "ollama-cloud": { in: 0, out: 0 },
  default: { in: 0.002, out: 0.008 },
};

function priceFor(provider: string): { in: number; out: number } {
  return PRICE_PER_1K[provider] ?? PRICE_PER_1K.default;
}

// ─── Sparkline ────────────────────────────────────────────────

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  return values
    .map((v) => {
      const idx = Math.min(SPARK.length - 1, Math.max(0, Math.round((v / max) * (SPARK.length - 1))));
      return SPARK[idx];
    })
    .join("");
}

// ─── Normalizer: clients ──────────────────────────────────────

interface ClientRow {
  provider: string;
  installId: string;
  email: string | null;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  costUsd: number;
  status: string;
}

function normalizeClients(raw: AnyRecord | null | undefined, provider: string | null): ClientRow[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw.clients) ? raw.clients : [];
  const rows: ClientRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as AnyRecord;
    const prov = (r.provider as string) ?? "unknown";
    if (provider && prov !== provider) continue;
    const inputTokens = Number(r.inputTokens ?? r.input_tokens ?? 0);
    const outputTokens = Number(r.outputTokens ?? r.output_tokens ?? 0);
    const cacheTokens = Number(r.cacheTokens ?? r.cache_tokens ?? 0);
    let costUsd = Number(r.costUsd ?? r.cost_usd ?? r.estimatedCostUsd ?? NaN);
    if (!Number.isFinite(costUsd)) {
      const p = priceFor(prov);
      costUsd = (inputTokens / 1000) * p.in + (outputTokens / 1000) * p.out;
    }
    rows.push({
      provider: prov,
      installId: (r.installId as string) ?? (r.install_id as string) ?? (r.accountKey as string) ?? "—",
      email: (r.email as string) ?? null,
      requests: Number(r.requests ?? r.requestCount ?? 0),
      inputTokens,
      outputTokens,
      cacheTokens,
      costUsd,
      status: (r.status as string) ?? "unknown",
    });
  }
  return rows;
}

// ─── Normalizer: history sparkline ────────────────────────────

interface HistoryBucket {
  provider: string;
  window: string;
  buckets: { ts: number; usedFraction: number }[];
}

function normalizeHistory(raw: AnyRecord | null | undefined, provider: string | null): HistoryBucket[] {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw.entries) ? raw.entries : [];
  const grouped = new Map<string, HistoryBucket>();
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const r = item as AnyRecord;
    const prov = (r.provider as string) ?? "unknown";
    if (provider && prov !== provider) continue;
    const window = (r.windowLabel as string) ?? (r.window as string) ?? "default";
    const key = `${prov}::${window}`;
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = { provider: prov, window, buckets: [] };
      grouped.set(key, bucket);
    }
    bucket.buckets.push({
      ts: Number(r.recordedAt ?? r.ts ?? 0),
      usedFraction: Number(r.usedFraction ?? 0),
    });
  }
  // Sort buckets chronologically
  for (const b of grouped.values()) {
    b.buckets.sort((a, b2) => a.ts - b2.ts);
  }
  return [...grouped.values()];
}

// ─── Table renderer ───────────────────────────────────────────

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(Math.round(n));
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(n >= 100 ? 0 : 2)}`;
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const len = [...s].length; // visual width approximation
  if (len >= width) return s;
  const pad = " ".repeat(width - len);
  return align === "right" ? pad + s : s + pad;
}

function renderTable(rows: ClientRow[]): string {
  const headers = ["CLIENT / INSTALL ID", "PROVIDER", "REQUESTS", "INPUT TOKENS", "OUTPUT TOKENS", "CACHE TOKENS", "ESTIMATED COST ($)"];
  const widths = [38, 22, 10, 14, 14, 14, 18];
  const sep = "─";
  const lines: string[] = [];
  const headerCells = headers.map((h, i) => pad(h, widths[i]));
  lines.push(headerCells.join("  "));
  lines.push(widths.map((w) => sep.repeat(w)).join("  "));
  if (rows.length === 0) {
    lines.push("(no client rows — broker belum menyediakan token burn)");
  }
  for (const r of rows) {
    const client = (r.email && r.email !== r.installId ? r.email : r.installId) || r.installId;
    lines.push(
      [
        pad(client.length > widths[0] ? client.slice(0, widths[0] - 1) + "…" : client, widths[0]),
        pad(r.provider, widths[1]),
        pad(fmtNum(r.requests), widths[2], "right"),
        pad(fmtNum(r.inputTokens), widths[3], "right"),
        pad(fmtNum(r.outputTokens), widths[4], "right"),
        pad(fmtNum(r.cacheTokens), widths[5], "right"),
        pad(fmtUsd(r.costUsd), widths[6], "right"),
      ].join("  "),
    );
  }
  return lines.join("\n");
}

function renderHistory(buckets: HistoryBucket[]): string {
  if (buckets.length === 0) return "(no history snapshots in window)";
  const lines: string[] = [];
  for (const b of buckets) {
    const values = b.buckets.map((x) => x.usedFraction);
    lines.push(`${b.provider} :: ${b.window}  ${sparkline(values)}  (n=${values.length})`);
  }
  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    exit(0);
  }

  const { url, token } = await resolveBroker();
  if (!token) {
    stderr.write("🔥 [Goblin Roast Error] Token broker tidak ditemukan.\n");
    stderr.write("💡 Hint: set OMP_AUTH_BROKER_TOKEN atau taruh di $HOME/.omp/auth-broker.token\n");
    exit(2);
  }

  // Probe broker once
  const reachable = await pingBroker(url, token);
  if (!reachable) {
    stderr.write(`🔥 [Goblin Roast Error] OMP broker offline di ${url}.\n`);
    stderr.write("💡 Hint: jalankan `gn restart` lalu coba lagi.\n");
    exit(3);
  }

  const sinceMs = Date.now() - args.days * 86_400_000;
  const [clientsRaw, historyRaw, ompUsage] = await Promise.all([
    fetchJson<AnyRecord>(`${url}/v1/usage/clients?sinceMs=${sinceMs}`, token),
    fetchJson<AnyRecord>(`${url}/v1/usage/history?sinceMs=${sinceMs}`, token),
    fetchOmpUsage(args.provider),
  ]);

  const rows = normalizeClients(clientsRaw, args.provider);
  const history = normalizeHistory(historyRaw, args.provider);

  // If broker has no client rows but omp usage has capacity, surface a friendly note.
  const brokerEmpty = rows.length === 0 && history.length === 0;
  let ompNote: string | null = null;
  if (ompUsage && Array.isArray(ompUsage.reports)) {
    const totalReports = (ompUsage.reports as AnyRecord[]).length;
    const disabled = Array.isArray(ompUsage.disabledCredentials) ? (ompUsage.disabledCredentials as AnyRecord[]).length : 0;
    if (totalReports > 0 && brokerEmpty) {
      ompNote = `(omp usage punya ${totalReports} report${disabled > 0 ? `, ${disabled} disabled` : ""} — tapi broker v17.1.4 belum expose token burn di /v1/usage/* )`;
    }
  }

  if (args.json) {
    const payload = {
      broker: url,
      generatedAt: new Date().toISOString(),
      days: args.days,
      provider: args.provider,
      clients: rows,
      history,
      ompUsage: ompUsage ?? null,
      note: ompNote,
    };
    stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  stdout.write(`🔥 Token & Cost Burn Tracker  (broker: ${url})\n`);
  if (args.provider) stdout.write(`filter: provider=${args.provider}\n`);
  stdout.write(`window: last ${args.days} day(s)\n\n`);
  stdout.write(renderTable(rows) + "\n");
  if (ompNote) {
    stdout.write(`\nℹ️  ${ompNote}\n`);
  }
  if (args.history) {
    stdout.write(`\n─── HISTORY SPARKLINE ───\n`);
    stdout.write(renderHistory(history) + "\n");
  }
}

main().catch((err) => {
  stderr.write(`🔥 [Goblin Roast Error] Unexpected failure: ${(err as Error).message}\n`);
  exit(1);
});