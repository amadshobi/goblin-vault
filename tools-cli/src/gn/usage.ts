#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus - Usage: Quota Dashboard & Real Token Burn Tracker
//
// MENGgantikan status-formatter.ts + burn.ts dengan implementasi
// 100% AKURAT — tanpa assumedTotal 100k, tanpa matematika rekaan.
//
// Mode:
//   1. QUOTA (default) : `gn usage [provider]`
//      Fetch live usage limits dari broker /v1/usage.
//      Output: visual status dashboard per account dengan progress bar,
//      persentase real, countdown resetsAt.
//
//   2. TOKEN BURN REAL  : `gn usage --token [provider] [--days N]`
//      Query SQLite ~/.omp/agent/agent.db tabel client_usage untuk
//      token & cost real. NO ASSUMED MATH.
//
//   3. JSON             : `gn usage --json`
//      Output JSON mentah (all mode).
//
// Flags:
//   --token             Mode real token burn (SQLite client_usage)
//   --json              Output JSON mentah
//   --days <int>        Window hari untuk token burn (default: 7)
//   -h, --help          Tampilkan bantuan
// ─────────────────────────────────────────────────────────────

import { argv, env, exit, stderr, stdout } from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

// ─── Types ────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

interface CliArgs {
  token: boolean;
  json: boolean;
  days: number;
  provider: string | null;
  help: boolean;
}

interface LimitRow {
  id: string;
  label: string;
  windowLabel: string;
  usedFraction: number;
  used: number | null;
  limit: number | null;
  status: string;
  resetsAt: number | null;
  metadata: AnyRecord;
}

interface ReportRow {
  provider: string;
  fetchedAt: number | null;
  metadata: AnyRecord;
  limits: LimitRow[];
}

interface TokenRow {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

// ─── Config ────────────────────────────────────────────────────

const DB_PATH = join(homedir(), ".omp", "agent", "agent.db");
const DEFAULT_BROKER_PORTS = [4001, 4000];
const REQUEST_TIMEOUT_MS = 8_000;

// ─── ANSI Colors ──────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function paint(s: string, color: keyof typeof C): string {
  if (!stdout.isTTY) return s;
  return `${C[color]}${s}${C.reset}`;
}

function colorForFraction(f: number, status?: string): keyof typeof C {
  const s = (status ?? "").toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired" || s === "disabled") return "red";
  if (!Number.isFinite(f)) return "gray";
  if (f >= 0.95) return "red";
  if (f >= 0.70) return "yellow";
  if (f >= 0.01) return "green";
  return "gray";
}

function statusBadge(fraction: number, status?: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired" || s === "disabled") return "🔴 EXHAUSTED";
  if (!Number.isFinite(fraction)) return "⚪ UNKNOWN";
  if (fraction >= 0.95) return "🔴 EXHAUSTED";
  if (fraction >= 0.70) return "⚠️  LOW";
  if (fraction >= 0.01) return "🟢 OK";
  return "⚪ UNUSED";
}

// ─── CLI Parsing ──────────────────────────────────────────────

function parseArgs(): CliArgs {
  const out: CliArgs = {
    token: false,
    json: false,
    days: 7,
    provider: null,
    help: false,
  };
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--token" || a === "-t") {
      out.token = true;
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--days" && args[i + 1]) {
      const n = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(n) && n > 0) out.days = n;
      i++;
    } else if (a === "--days=") {
      // bare --days= with no value = skip
      i++;
    } else if (a.startsWith("--days=")) {
      const n = Number.parseInt(a.slice("--days=".length), 10);
      if (Number.isFinite(n) && n > 0) out.days = n;
    } else if (a.startsWith("--")) {
      stderr.write(`⚠️  Unknown flag ignored: ${a}\n`);
    } else if (!out.provider) {
      out.provider = a;
    }
  }

  return out;
}

function printHelp(): void {
  stdout.write(`🧙‍♂️ GN USAGE — Account Quota & Real Token Burn Dashboard

DESKRIPSI
  Dashboard terpadu untuk:
  - Live quota usage per-akun dari broker OMP (/v1/usage)
  - Token burn real & cost dari SQLite DB (client_usage)
  TANPA matematika rekaan — 100% data jujur dari database.

USAGE
  $ gn usage [provider] [options]
  $ gn u [provider] [options]

MODES
  (default)   Tampilkan dashboard kuota live (Daily/Weekly) per akun
              dengan progress bar, persentase, status badge, countdown.
  --token     Mode token burn & cost REAL dari SQLite
              (query tabel client_usage agent.db)

OPTIONS
  --token, -t        Mode token burn (SQLite client_usage)
  --json             Output JSON mentah untuk scripting / piping
  --days <int>       Window hari untuk token burn (default: 7)
  --provider <id>    Filter 1 provider spesifik
  -h, --help         Tampilkan bantuan ini

EXAMPLES
  $ gn usage                          Dashboard kuota live semua akun
  $ gn usage google-antigravity       Filter provider Antigravity
  $ gn usage --token                  Token burn real semua provider
  $ gn usage --token google-antigravity --days 14   Token AGY 14 hari
  $ gn usage --json                   Output JSON mentah
`);
}

// ─── Broker Discovery ─────────────────────────────────────────

async function resolveBroker(): Promise<string | null> {
  // Prefer explicit env override
  const explicit = env.OMP_AUTH_BROKER_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Try default ports in order
  for (const port of DEFAULT_BROKER_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${url}/health`, { signal: ctrl.signal });
      clearTimeout(to);
      if (res.ok) return url;
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchJson<T>(url: string, path: string): Promise<T | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = readBrokerToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${url}${path}`, { headers, signal: ctrl.signal });
    if (!res.ok) {
      stderr.write(`⚠️  ${url}${path} -> HTTP ${res.status}\n`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    stderr.write(`⚠️  ${url}${path} -> ${(err as Error).message}\n`);
    return null;
  } finally {
    clearTimeout(to);
  }
}

function readBrokerToken(): string | null {
  if (env.OMP_AUTH_BROKER_TOKEN) return env.OMP_AUTH_BROKER_TOKEN;
  try {
    return readFileSync(join(homedir(), ".omp", "auth-broker.token"), "utf8").trim();
  } catch {
    return null;
  }
}

// ─── Format Helpers ───────────────────────────────────────────

const BAR_WIDTH = 28;

function renderBar(fraction: number, status?: string): string {
  const color = colorForFraction(fraction, status);
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const filled = Math.round(f * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return `${paint("█".repeat(filled), color)}${paint("░".repeat(empty), "dim")}`;
}

function fmtPct(f: number): string {
  if (!Number.isFinite(f)) return "0.0%";
  return `${(f * 100).toFixed(f > 0 && f < 0.01 ? 2 : f < 0.1 ? 1 : 0)}%`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(Math.round(n));
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(Math.abs(n) >= 100 ? 2 : 4)}`;
}

function countdownTo(ms: number): string {
  const diff = ms - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "resetting…";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const raw = s.replace(/\x1b\[[0-9;]*m/g, "");
  const len = [...raw].length;
  if (len >= width) return s;
  const fill = " ".repeat(width - len);
  return align === "right" ? fill + s : s + fill;
}

// ─── Quota Mode (Default) ─────────────────────────────────────

function normalizeLimits(raw: AnyRecord): LimitRow[] {
  if (!raw || !Array.isArray(raw.limits)) return [];
  return (raw.limits as AnyRecord[]).map((l) => {
    const window = (l.window as AnyRecord | undefined) ?? {};
    const amount = (l.amount as AnyRecord | undefined) ?? {};

    const windowLabel =
      (l.windowLabel as string) ??
      (window.label as string) ??
      (l.id as string)?.split(":").pop() ??
      "—";

    let usedFraction = NaN;
    let used: number | null = null;
    let limit: number | null = null;

    // Primary: remainingFraction from Google PaAPI
    if (amount.remainingFraction != null && Number.isFinite(Number(amount.remainingFraction))) {
      usedFraction = 1 - Number(amount.remainingFraction);
    }
    // Secondary: used/limit integers
    if (amount.used != null && amount.limit != null && Number(amount.limit) > 0) {
      usedFraction = Number(amount.used) / Number(amount.limit);
      used = Number(amount.used);
      limit = Number(amount.limit);
    }
    // Tertiary: direct usedFraction field
    if (!Number.isFinite(usedFraction)) {
      usedFraction = Number(l.usedFraction ?? amount.usedFraction ?? NaN);
    }

    const resetsAt = Number(window.resetsAt ?? l.resetsAt ?? NaN);

    return {
      id: (l.id as string) ?? "unknown",
      label: (l.label as string) ?? "—",
      windowLabel,
      usedFraction: Number.isFinite(usedFraction) ? Math.max(0, Math.min(1, usedFraction)) : 0,
      used,
      limit,
      status: (l.status as string) ?? "unknown",
      resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
      metadata: (l.metadata as AnyRecord) ?? {},
    };
  });
}

async function renderQuota(provider: string | null): Promise<AnyRecord | null> {
  const brokerUrl = await resolveBroker() ?? `http://127.0.0.1:${DEFAULT_BROKER_PORTS[0]}`;

  // Fetch usage data
  let usagePath = "/v1/usage";
  if (provider) usagePath += `?provider=${encodeURIComponent(provider)}`;
  const usageData = await fetchJson<AnyRecord>(brokerUrl, usagePath);

  if (!usageData) {
    stderr.write("🔥 [Goblin Roast Error] Gagal fetch data kuota dari broker.\n");
    stderr.write(`💡 Broker URL: ${brokerUrl}. Pastikan omp-broker aktif ('gn restart').\n`);
    return null;
  }

  if (!usageData) {
    stderr.write("🔥 [Goblin Roast Error] Gagal fetch data kuota dari broker.\n");
    return null;
  }

  const reports = (Array.isArray(usageData.reports) ? usageData.reports : []) as AnyRecord[];
  const generatedAt = usageData.generatedAt as number | null ?? Date.now();

  if (reports.length === 0) {
    stdout.write(paint("ℹ️  Tidak ada data kuota untuk akun yang terdaftar.", "dim") + "\n");
    stdout.write("💡 Jalankan `gn sync` atau pastikan akun aktif di broker.\n");
    return usageData;
  }

  // Dedupe by (provider, identityKey) — keep freshest
  const latestPerAccount = new Map<string, AnyRecord>();
  let anonIdx = 1;
  for (const r of reports) {
    const prov = (r.provider as string) ?? "unknown";
    if (provider && prov !== provider) continue;
    const meta = (r.metadata as AnyRecord) ?? {};
    const idKey = (meta.email as string) ?? (meta.accountId as string) ?? (meta.projectId as string) ?? `anon_${anonIdx++}`;
    const key = `${prov}::${idKey}`;
    const existing = latestPerAccount.get(key);
    if (!existing || (r.fetchedAt as number ?? 0) > (existing.fetchedAt as number ?? 0)) {
      latestPerAccount.set(key, r);
    }
  }

  // Group by provider
  const accountsByProvider = new Map<string, AnyRecord[]>();
  for (const [, r] of latestPerAccount) {
    const prov = (r.provider as string) ?? "unknown";
    const arr = accountsByProvider.get(prov) ?? [];
    arr.push(r);
    accountsByProvider.set(prov, arr);
  }

  // Render per-provider
  for (const [prov, accounts] of accountsByProvider) {
    stdout.write(`\n${paint("●", "green")} ${paint(prov, "bold")}  ${paint(`(${accounts.length} account${accounts.length > 1 ? "s" : ""})`, "dim")}\n`);

    for (const acc of accounts) {
      const meta = (acc.metadata as AnyRecord) ?? {};
      const email = (meta.email as string) ?? (meta.accountId as string) ?? "—";
      const plan = (meta.plan as string) ?? (meta.planType as string);
      const planTag = plan ? ` ${paint(`[${plan}]`, "dim")}` : "";

      stdout.write(`  ${paint("▸", "dim")} ${paint(email, "bold")}${planTag}\n`);

      const limits = normalizeLimits(acc);
      if (limits.length === 0) {
        stdout.write(`    ${paint("(no limits reported)", "dim")}\n`);
        continue;
      }

      // Group by window label (Daily, Weekly)
      const byWindow = new Map<string, LimitRow[]>();
      for (const l of limits) {
        const wl = l.windowLabel;
        const arr = byWindow.get(wl) ?? [];
        arr.push(l);
        byWindow.set(wl, arr);
      }

      for (const [windowLabel, rows] of byWindow) {
        const winHeader = windowLabel === "Daily" ? "📅 Daily" : windowLabel === "Weekly" ? "📆 Weekly" : windowLabel;
        stdout.write(`    ${paint(winHeader, "cyan")}\n`);

        for (const row of rows) {
          const label = (row.label || "—").padEnd(24);
          const bar = renderBar(row.usedFraction, row.status);
          const pct = fmtPct(row.usedFraction);
          const badge = statusBadge(row.usedFraction, row.status);
          const resetPart = row.resetsAt
            ? `${paint("·", "dim")} resets in ${paint(countdownTo(row.resetsAt).padEnd(12), "dim")}`
            : "";

          // Show exact used/limit if available
          const usedPart = row.used != null && row.limit != null
            ? `${paint(`[${fmtNum(row.used)}/${fmtNum(row.limit)}]`, "dim")} `
            : "";

          stdout.write(`      ${paint(label, "bold")} ${bar}  ${pad(pct, 6)} ${usedPart}${badge}  ${resetPart}\n`);
        }
      }
    }
  }

  // Disabled credentials section
  const disabled = (Array.isArray(usageData.disabledCredentials) ? usageData.disabledCredentials : []) as AnyRecord[];
  const filteredDisabled = provider
    ? disabled.filter((d) => d.provider === provider)
    : disabled;

  if (filteredDisabled.length > 0) {
    stdout.write(`\n${paint("✗ Disabled / Exhausted Credentials", "red")}\n`);
    for (const d of filteredDisabled) {
      const email = (d.email as string) ?? (d.accountId as string) ?? "—";
      const reason = (d.reason as string) ?? "exhausted";
      stdout.write(`  ${paint("✗", "red")} ${email}  ${paint(`(${reason})`, "dim")}\n`);
    }
  }

  return usageData;
}

// ─── Token Burn Mode (SQLite real data) ───────────────────────

interface DbTokenRow {
  provider: string;
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
}

/** Extract provider name from model_key (e.g. "google-antigravity/gemini-3.5-flash" → "google-antigravity") */
function providerFromModelKey(modelKey: string): string {
  return modelKey.split("/")[0] || "unknown";
}

/** Query model_perf table — BERISI DATA REAL output_tokens & samples (request count) */
function queryModelPerf(db: Database, provider: string | null, sinceSec: number): TokenRow[] {
  // model_perf.updated_at is epoch SECONDS (default: CAST(strftime('%s','now') AS INTEGER))
  let sql = `SELECT model_key, SUM(samples) as samples, SUM(output_tokens) as output_tokens FROM model_perf WHERE updated_at >= ?`;
  const params: (number | string)[] = [sinceSec];

  if (provider) {
    sql += ` AND model_key LIKE ?`;
    params.push(`${provider}/%`);
  }

  sql += ` GROUP BY model_key ORDER BY model_key`;

  interface ModelPerfRow {
    model_key: string;
    samples: number;
    output_tokens: number;
  }

  const rows = db.query(sql).all(...params) as ModelPerfRow[];

  if (rows.length === 0) {
    return [];
  }

  return rows.map((r) => ({
    provider: providerFromModelKey(r.model_key),
    model: r.model_key,
    requests: r.samples || 0,
    inputTokens: 0, // model_perf tidak menyimpan input_tokens — hanya output yang tercatat
    outputTokens: r.output_tokens || 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0, // cost tidak tersedia di model_perf
  }));
}

/** Query client_usage table — full token breakdown (may be empty if OMP hasn't aggregated) */
function queryClientUsage(db: Database, provider: string | null, sinceMs: number): TokenRow[] {
  const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='client_usage'").get();
  if (!tableExists) return [];

  let sql = `SELECT provider, model, SUM(requests) as requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(cache_read_tokens) as cache_read_tokens, SUM(cache_write_tokens) as cache_write_tokens, SUM(cost_usd) as cost_usd FROM client_usage WHERE recorded_at >= ?`;
  const params: (number | string)[] = [sinceMs];

  if (provider) {
    sql += ` AND provider = ?`;
    params.push(provider);
  }

  sql += ` GROUP BY provider, model ORDER BY provider, model`;

  const rows = db.query(sql).all(...params) as DbTokenRow[];

  if (rows.length === 0) return [];

  return rows.map((r) => ({
    provider: r.provider,
    model: r.model || "—",
    requests: r.requests || 0,
    inputTokens: r.input_tokens || 0,
    outputTokens: r.output_tokens || 0,
    cacheReadTokens: r.cache_read_tokens || 0,
    cacheWriteTokens: r.cache_write_tokens || 0,
    costUsd: r.cost_usd || 0,
  }));
}

/** Query usage_cost_history for cost-only data */
function queryCostHistory(db: Database, provider: string | null, sinceMs: number): TokenRow[] {
  const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_cost_history'").get();
  if (!tableExists) return [];

  let sql = `SELECT provider, SUM(cost_usd) as cost_usd, COUNT(*) as entries FROM usage_cost_history WHERE recorded_at >= ?`;
  const params: (number | string)[] = [sinceMs];

  if (provider) {
    sql += ` AND provider = ?`;
    params.push(provider);
  }

  sql += ` GROUP BY provider ORDER BY provider`;

  const costRows = db.query(sql).all(...params) as { provider: string; cost_usd: number; entries: number }[];
  if (costRows.length === 0) return [];

  return costRows.map((r) => ({
    provider: r.provider,
    model: "(cost history)",
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: r.cost_usd,
  }));
}

/** Query usage_history for quota-based data (only used_fraction, no token counts) */
function queryUsageHistory(db: Database, provider: string | null, sinceMs: number): { provider: string; snapshots: number }[] {
  const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_history'").get();
  if (!tableExists) return [];

  let sql = `SELECT provider, COUNT(*) as snapshots FROM usage_history WHERE recorded_at >= ?`;
  const params: (number | string)[] = [sinceMs];

  if (provider) {
    sql += ` AND provider = ?`;
    params.push(provider);
  }

  sql += ` GROUP BY provider ORDER BY provider`;

  return db.query(sql).all(...params) as { provider: string; snapshots: number }[];
}

function queryTokenBurn(provider: string | null, days: number): TokenRow[] {
  if (!existsSync(DB_PATH)) {
    stderr.write(`⚠️  Database tidak ditemukan: ${DB_PATH}\n`);
    stderr.write("💡 Pastikan OMP agent sudah berjalan dan menghasilkan data.\n");
    return [];
  }

  let db: Database | null = null;
  try {
    db = new Database(DB_PATH, { readonly: true });
  } catch (err) {
    stderr.write(`⚠️  Gagal membuka database SQLite: ${(err as Error).message}\n`);
    return [];
  }

  try {
    const sinceMs = Date.now() - days * 86_400_000;
    const sinceSec = Math.floor(sinceMs / 1000);

    // ── Source Priority Chain: model_perf > client_usage > cost_history ──
    // model_perf stores updated_at in epoch SECONDS
    const perfRows = queryModelPerf(db, provider, sinceSec);
    if (perfRows.length > 0) {
      return perfRows;
    }

    // client_usage stores recorded_at in epoch MILLISECONDS
    const clientRows = queryClientUsage(db, provider, sinceMs);
    if (clientRows.length > 0) {
      return clientRows;
    }

    // usage_cost_history stores recorded_at in epoch MILLISECONDS
    const costRows = queryCostHistory(db, provider, sinceMs);
    if (costRows.length > 0) {
      return costRows;
    }

    // Fallback: report what exists in usage_history (quota snapshots, no token data)
    const usageRows = queryUsageHistory(db, provider, sinceMs);
    if (usageRows.length > 0) {
      const provNames = usageRows.map((r) => r.provider).join(", ");
      stderr.write(`ℹ️  ${usageRows.length} provider(s) dengan data quota di usage_history: ${provNames}\n`);
      stderr.write("ℹ️  Tabel model_perf, client_usage, dan usage_cost_history kosong untuk window ini.\n");
      stderr.write("💡 Data token burn akan tersedia setelah OMP gateway memproses request dan mencatatnya.\n");
    }

    return [];
  } catch (err) {
    stderr.write(`⚠️  SQLite query error: ${(err as Error).message}\n`);
    return [];
  } finally {
    if (db) db.close();
  }
}

function renderTokenTable(rows: TokenRow[]): string {
  // Detect if data came from model_perf (no input tokens tracked)
  const fromModelPerf = rows.length > 0 && rows.every((r) => r.inputTokens === 0 && r.cacheReadTokens === 0 && r.cacheWriteTokens === 0 && r.costUsd === 0);
  const headers = fromModelPerf
    ? ["PROVIDER", "MODEL", "REQUESTS", "INPUT TOKENS", "OUTPUT TOKENS", "CACHE TOKENS", "COST ($)"]
    : ["PROVIDER", "MODEL", "REQUESTS", "INPUT TOKENS", "OUTPUT TOKENS", "CACHE TOKENS", "COST ($)"];
  const widths = [24, 28, 10, 14, 14, 14, 12];
  const sep = "─";
  const lines: string[] = [];

  // Header
  const headerCells = headers.map((h, i) => pad(h, widths[i]));
  lines.push(headerCells.join("  "));
  lines.push(widths.map((w) => sep.repeat(w)).join("  "));

  if (rows.length === 0) {
    lines.push(paint("0 tokens burned — belum ada data token tercatat untuk window ini.", "dim"));
    return lines.join("\n");
  }

  for (const r of rows) {
    const cacheTokens = r.cacheReadTokens + r.cacheWriteTokens;
    const inputDisplay = fromModelPerf ? paint("—", "dim") : fmtNum(r.inputTokens);
    const costDisplay = fromModelPerf ? paint("—", "dim") : fmtUsd(r.costUsd);
    lines.push([
      pad(r.provider.slice(0, widths[0]), widths[0]),
      pad(r.model.slice(0, widths[1]), widths[1]),
      pad(fmtNum(r.requests), widths[2], "right"),
      pad(inputDisplay, widths[3], "right"),
      pad(fmtNum(r.outputTokens), widths[4], "right"),
      pad(fmtNum(cacheTokens), widths[5], "right"),
      pad(costDisplay, widths[6], "right"),
    ].join("  "));
  }

  // Totals row
  const totals = rows.reduce(
    (acc, r) => {
      acc.requests += r.requests;
      acc.inputTokens += r.inputTokens;
      acc.outputTokens += r.outputTokens;
      acc.cacheReadTokens += r.cacheReadTokens;
      acc.cacheWriteTokens += r.cacheWriteTokens;
      acc.costUsd += r.costUsd;
      return acc;
    },
    { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
  );

  lines.push(widths.map((w) => sep.repeat(w)).join("  "));
  const totalCache = totals.cacheReadTokens + totals.cacheWriteTokens;
  const totalInputDisplay = fromModelPerf ? paint("—", "dim") : paint(fmtNum(totals.inputTokens), "bold");
  const totalCostDisplay = fromModelPerf ? paint("—", "dim") : paint(fmtUsd(totals.costUsd), "bold");
  lines.push([
    pad(paint("TOTAL", "bold"), widths[0]),
    pad("", widths[1]),
    pad(paint(fmtNum(totals.requests), "bold"), widths[2], "right"),
    pad(totalInputDisplay, widths[3], "right"),
    pad(paint(fmtNum(totals.outputTokens), "bold"), widths[4], "right"),
    pad(paint(fmtNum(totalCache), "bold"), widths[5], "right"),
    pad(totalCostDisplay, widths[6], "right"),
  ].join("  "));

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    exit(0);
  }

  if (args.token) {
    // ── TOKEN BURN MODE (SQLite real data) ──
    const providerFilter = args.provider;
    if (providerFilter) {
      stdout.write(`${paint("🔥 Real Token Burn", "bold")}  (filter: ${providerFilter}, ${args.days} days)\n\n`);
    } else {
      stdout.write(`${paint("🔥 Real Token Burn", "bold")}  (all providers, ${args.days} days)\n\n`);
    }

    const rows = queryTokenBurn(providerFilter, args.days);

    // Detect data source
    const fromModelPerf = rows.length > 0 && rows.every((r) => r.inputTokens === 0 && r.cacheReadTokens === 0 && r.cacheWriteTokens === 0 && r.costUsd === 0);
    const dataSource = fromModelPerf ? "model_perf" : "client_usage";

    if (args.json) {
      const payload = {
        mode: "token",
        provider: providerFilter,
        days: args.days,
        generatedAt: new Date().toISOString(),
        source: `sqlite:${dataSource}`,
        database: DB_PATH,
        rows,
        summary: {
          totalRequests: rows.reduce((s, r) => s + r.requests, 0),
          totalInputTokens: rows.reduce((s, r) => s + r.inputTokens, 0),
          totalOutputTokens: rows.reduce((s, r) => s + r.outputTokens, 0),
          totalCacheTokens: rows.reduce((s, r) => s + r.cacheReadTokens + r.cacheWriteTokens, 0),
          totalCostUsd: rows.reduce((s, r) => s + r.costUsd, 0),
        },
      };
      stdout.write(JSON.stringify(payload, null, 2) + "\n");
      return;
    }

    if (rows.length === 0) {
      stdout.write(paint("ℹ️  0 tokens burned — belum ada data token tercatat untuk window ini.\n\n", "dim"));
      stdout.write("💡 Berikut kemungkinan penyebab:\n");
      stdout.write("   • OMP gateway belum memproses request apapun\n");
      stdout.write("   • Semua tabel token (model_perf, client_usage, cost_history) kosong\n");
      stdout.write("   • Filter provider terlalu spesifik\n");
      stdout.write("   • Database diperbarui dengan data model_perf (output_tokens, samples)\n");
      stdout.write("     Jalankan request dulu melalui OMP gateway agar tercatat.\n");
      return;
    }

    stdout.write(renderTokenTable(rows) + "\n");
    stdout.write(`\n${paint("ℹ️  Source:", "dim")} ${DB_PATH} (tabel: ${dataSource})\n`);
    stdout.write(`${paint("ℹ️  Window:", "dim")} last ${args.days} day(s)\n`);
    if (fromModelPerf) {
      stdout.write(`${paint("ℹ️  Note:", "dim")} Data dari model_perf — hanya output_tokens & request count.\n`);
      stdout.write(`  ${paint("   Input tokens & cost tidak tersedia (tidak disimpan oleh OMP di model_perf).", "dim")}\n`);
      stdout.write(`  ${paint("   Gunakan tabel client_usage untuk data lengkap jika sudah terisi.", "dim")}\n`);
    }
    return;
  }

  // ── QUOTA MODE (default) ──
  if (args.json) {
    // JSON raw mode
    const brokerUrl = await resolveBroker();
    let usagePath = "/v1/usage";
    if (args.provider) usagePath += `?provider=${encodeURIComponent(args.provider)}`;
    const usageData = await fetchJson<AnyRecord>(brokerUrl ?? "http://127.0.0.1:4001", usagePath);

    const payload = {
      mode: "quota",
      provider: args.provider,
      generatedAt: new Date().toISOString(),
      broker: brokerUrl,
      usage: usageData ?? null,
    };
    stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  // Default: visual quota dashboard
  stdout.write(paint("📊 ACCOUNT QUOTA DASHBOARD", "bold") + "\n");
  stdout.write(paint("  Live usage limits across authenticated accounts", "dim") + "\n");
  if (args.provider) {
    stdout.write(paint(`  Filter: ${args.provider}`, "dim") + "\n");
  }

  const usageData = await renderQuota(args.provider);

  if (usageData && !args.json) {
    // Show token quick summary from either client_usage or model_perf
    if (existsSync(DB_PATH)) {
      try {
        const db = new Database(DB_PATH, { readonly: true });
        const sinceMs = Date.now() - 7 * 86_400_000;
        const sinceSec = Math.floor(sinceMs / 1000);

        // Try client_usage first (has full token & cost data)
        const clientTable = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='client_usage'").get();
        if (clientTable) {
          const tokenCount = db.query(
            `SELECT COUNT(*) as cnt, SUM(requests) as reqs, SUM(input_tokens + output_tokens) as total_tokens, SUM(cost_usd) as total_cost FROM client_usage WHERE recorded_at >= ?`
          ).get(sinceMs) as { cnt: number; reqs: number | null; total_tokens: number | null; total_cost: number | null } | undefined;

          if (tokenCount && tokenCount.cnt > 0) {
            stdout.write(`\n${paint("⚡ Quick Token Summary (7d)", "bold")}\n`);
            stdout.write(`  Requests: ${paint(fmtNum(tokenCount.reqs ?? 0), "green")}\n`);
            stdout.write(`  Total Tokens: ${paint(fmtNum(tokenCount.total_tokens ?? 0), "green")}\n`);
            stdout.write(`  Total Cost: ${paint(fmtUsd(tokenCount.total_cost ?? 0), "green")}\n`);
            stdout.write(`  ${paint("(use --token for detailed breakdown)", "dim")}\n`);
          }
        }

        // Fallback to model_perf if client_usage has no data (model_perf always has data)
        const perfTable = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='model_perf'").get();
        if (perfTable) {
          const perfCount = db.query(
            `SELECT COUNT(*) as cnt, SUM(samples) as total_samples, SUM(output_tokens) as total_output FROM model_perf WHERE updated_at >= ?`
          ).get(sinceSec) as { cnt: number; total_samples: number | null; total_output: number | null } | undefined;

          if (perfCount && perfCount.cnt > 0) {
            stdout.write(`\n${paint("⚡ Quick Token Summary (7d)", "bold")}  ${paint("(from model_perf)", "dim")}\n`);
            stdout.write(`  Requests: ${paint(fmtNum(perfCount.total_samples ?? 0), "green")}\n`);
            stdout.write(`  Output Tokens: ${paint(fmtNum(perfCount.total_output ?? 0), "green")}\n`);
            stdout.write(`  Input Tokens: ${paint("not tracked in model_perf", "dim")}\n`);
            stdout.write(`  ${paint("(use --token for detailed breakdown)", "dim")}\n`);
          }
        }
        db.close();
      } catch {
        // silently skip
      }
    }
  }
}

main().catch((err) => {
  stderr.write(`🔥 [Goblin Roast Error] usage.ts: ${(err as Error).message}\n`);
  exit(1);
});
