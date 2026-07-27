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
import { fetchOllamaAccountsMeta } from "./ollama-me";

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
  accountKey: string | null;
  accountId: string | null;
  email: string | null;
  projectId: string | null;
  label: string;
  window: string;
  usedFraction: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  costUsd: number;
  status: string;
  resetsAt: number | null;
  source: "broker" | "history" | "snapshot";
}

function coerceNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pushClientRow(
  target: Map<string, ClientRow>,
  row: Omit<ClientRow, "source">,
  source: ClientRow["source"],
): void {
  // Normalize identity: email is the strongest, then accountId, then
  // accountKey, then projectId. This makes snapshot (email=null,
  // accountId="goblin-vault") and history (accountKey="oauth|secret:...")
  // collide on the same dedup key when the underlying account matches.
  const identity = row.email || row.accountId || row.accountKey || row.projectId || row.installId;
  const key = `${row.provider}::${identity}::${normalizeLimitKey(row.label || row.window)}`;
  const existing = target.get(key);
  const priority = { broker: 3, history: 2, snapshot: 1 } as const;

  if (existing) {
    if (priority[source] <= priority[existing.source]) {
      target.set(key, { ...existing, ...mergeFill(existing, row) });
      return;
    }
    target.set(key, { ...row, source, ...mergeFill(row, existing) });
    return;
  }

  target.set(key, { ...row, source });
}

function normalizeLimitKey(s: string): string {
  return s.replace(/\s*(Daily|Weekly|Monthly|Annual)\s*$/i, "").replace(/\b\d+\s*(days?|d|hours?|h)\b/gi, "").trim();
}

// Final consolidation pass: walks all rows and collapses duplicates that
// share provider+limit family but have opaque identity keys (e.g. snapshot
// uses email="goblin-vault", history uses accountKey="oauth|secret:...").
// Only merges when there's exactly one row of each opaque form per
// (provider, limit family) — prevents accidental cross-account merges.
function consolidateOpaqueIdentities(target: Map<string, ClientRow>): void {
  const byProviderLabel = new Map<string, ClientRow[]>();
  for (const row of target.values()) {
    const key = `${row.provider}::${normalizeLimitKey(row.label || row.window)}`;
    const arr = byProviderLabel.get(key) ?? [];
    arr.push(row);
    byProviderLabel.set(key, arr);
  }
  for (const arr of byProviderLabel.values()) {
    if (arr.length !== 2) continue; // only act on exact 2-row duplicates
    const [a, b] = arr;
    // Identify which side has stronger identity (email/accountId) and
    // which has weaker (accountKey-only or null).
    const aStrength = (a.email ? 2 : 0) + (a.accountId ? 1 : 0) + (a.accountKey ? 1 : 0);
    const bStrength = (b.email ? 2 : 0) + (b.accountId ? 1 : 0) + (b.accountKey ? 1 : 0);
    if (aStrength === bStrength) continue; // ambiguous — leave both
    const [strong, weak] = aStrength > bStrength ? [a, b] : [b, a];
    const strongKey = [...target.entries()].find(([, v]) => v === strong)?.[0];
    const weakKey = [...target.entries()].find(([, v]) => v === weak)?.[0];
    if (!strongKey || !weakKey || strongKey === weakKey) continue;
    // Verify loose identity (email match, accountKey contains email, etc.)
    if (!sameIdentityLoose(strong, weak)) continue;
    target.set(strongKey, { ...strong, ...mergeFill(strong, weak) });
    target.delete(weakKey);
  }
}

// Strip the window qualifier (Daily/Weekly/Monthly/30d/etc) and compare
// the bare limit label. "Usage (Google) · Weekly" ≈ "Usage (Google) · Daily".
// Falls back to exact match when both labels look identical (e.g. "30 days").
function sameLimitFamily(a: { label: string; window: string }, b: { label: string; window: string }): boolean {
  const strip = (s: string) => s.replace(/\s*(Daily|Weekly|Monthly|Annual)\s*$/i, "").trim();
  const stripShort = (s: string) => s.replace(/\b\d+\s*(days?|d|hours?|h)\b/gi, "").trim();
  if (a.label && b.label && a.label === b.label) return true;
  if (a.window && b.window && a.window === b.window) return true;
  const as = strip(a.label || a.window || "");
  const bs = strip(b.label || b.window || "");
  if (as && bs && as === bs) return true;
  const as2 = stripShort(as || a.label || "");
  const bs2 = stripShort(bs || b.label || "");
  if (as2 && bs2 && as2 === bs2) return true;
  return false;
}

function sameIdentityLoose(a: ClientRow, b: ClientRow): boolean {
  if (a.email && b.email && a.email === b.email) return true;
  if (a.email && b.accountKey && b.accountKey.includes(a.email)) return true;
  if (b.email && a.accountKey && a.accountKey.includes(b.email)) return true;
  if (a.accountKey && b.accountKey && a.accountKey === b.accountKey) return true;
  if (a.accountId && b.accountId && a.accountId === b.accountId) return true;
  if (a.accountId && b.accountKey && b.accountKey.includes(a.accountId)) return true;
  if (b.accountId && a.accountKey && a.accountKey.includes(b.accountId)) return true;
  if (a.projectId && b.projectId && a.projectId === b.projectId) return true;
  return false;
}

function mergeFill(winner: Omit<ClientRow, "source">, loser: Omit<ClientRow, "source">): Partial<ClientRow> {
  const out: Partial<ClientRow> = {};
  if (!winner.accountKey && loser.accountKey) out.accountKey = loser.accountKey;
  if (!winner.accountId && loser.accountId) out.accountId = loser.accountId;
  if (!winner.email && loser.email) out.email = loser.email;
  if (!winner.projectId && loser.projectId) out.projectId = loser.projectId;
  if (!winner.installId || winner.installId === "—") out.installId = loser.installId;
  if (!winner.label || winner.label === "—") out.label = loser.label;
  if (!winner.window || winner.window === "—") out.window = loser.window;
  if (winner.resetsAt == null && loser.resetsAt != null) out.resetsAt = loser.resetsAt;
  if (winner.requests === 0 && loser.requests > 0) out.requests = loser.requests;
  if (winner.inputTokens === 0 && loser.inputTokens > 0) out.inputTokens = loser.inputTokens;
  if (winner.outputTokens === 0 && loser.outputTokens > 0) out.outputTokens = loser.outputTokens;
  if (winner.cacheTokens === 0 && loser.cacheTokens > 0) out.cacheTokens = loser.cacheTokens;
  if ((winner.costUsd === 0 || !Number.isFinite(winner.costUsd)) && loser.costUsd > 0) out.costUsd = loser.costUsd;
  if ((winner.status === "unknown" || !winner.status) && loser.status && loser.status !== "unknown") out.status = loser.status;
  return out;
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
    const inputTokens = coerceNumber(r.inputTokens ?? r.input_tokens);
    const outputTokens = coerceNumber(r.outputTokens ?? r.output_tokens);
    const cacheTokens = coerceNumber(r.cacheTokens ?? r.cache_tokens);
    let costUsd = Number(r.costUsd ?? r.cost_usd ?? r.estimatedCostUsd ?? NaN);
    if (!Number.isFinite(costUsd)) {
      const p = priceFor(prov);
      costUsd = (inputTokens / 1000) * p.in + (outputTokens / 1000) * p.out;
    }
    rows.push({
      provider: prov,
      installId: (r.installId as string) ?? (r.install_id as string) ?? (r.accountKey as string) ?? "—",
      accountKey: (r.accountKey as string) ?? null,
      accountId: (r.accountId as string) ?? null,
      email: (r.email as string) ?? null,
      projectId: (r.projectId as string) ?? null,
      label: (r.label as string) ?? (r.limitId as string) ?? "—",
      window: (r.windowLabel as string) ?? (r.window as string) ?? "—",
      usedFraction: coerceNumber(r.usedFraction, 0),
      requests: coerceNumber(r.requests ?? r.requestCount),
      inputTokens,
      outputTokens,
      cacheTokens,
      costUsd,
      status: (r.status as string) ?? "unknown",
      resetsAt: Number.isFinite(Number(r.resetsAt)) ? Number(r.resetsAt) : null,
      source: "broker",
    });
  }
  return rows;
}

// Derive ClientRows from /v1/usage/history entries. History stores per-
// (accountKey, limitId) snapshots with email, provider, usedFraction,
// label, windowLabel, status, resetsAt. We pick the freshest snapshot per
// unique key and synthesize a ClientRow.
function rowsFromHistory(raw: AnyRecord | null | undefined, provider: string | null): ClientRow[] {
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw.entries) ? raw.entries : [];
  if (entries.length === 0) return [];

  // latest snapshot per (accountKey|email, limitId)
  const latest = new Map<string, AnyRecord>();
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const r = item as AnyRecord;
    const prov = (r.provider as string) ?? "unknown";
    if (provider && prov !== provider) continue;
    const idKey =
      (r.accountKey as string | undefined) ??
      (r.email as string | undefined) ??
      (r.accountId as string | undefined) ??
      "anon";
    const key = `${prov}::${idKey}::${r.limitId ?? r.label ?? "—"}`;
    const cur = latest.get(key);
    if (!cur || coerceNumber(r.recordedAt) > coerceNumber(cur.recordedAt)) {
      latest.set(key, r);
    }
  }

  const out: ClientRow[] = [];
  for (const r of latest.values()) {
    const prov = (r.provider as string) ?? "unknown";
    const usedFraction = coerceNumber(r.usedFraction, 0);
    const p = priceFor(prov);
    // Synthesize a token estimate: if usedFraction known, assume a
    // 100k-token window for non-zero providers; otherwise 0. This keeps
    // the cost column meaningful when broker doesn't expose real tokens.
    const assumedTotal = p.in + p.out > 0 ? 100_000 : 0;
    const inputTokens = Math.round(usedFraction * assumedTotal * 0.7);
    const outputTokens = Math.round(usedFraction * assumedTotal * 0.3);
    const costUsd =
      (inputTokens / 1000) * p.in + (outputTokens / 1000) * p.out;
    out.push({
      provider: prov,
      installId: (r.email as string) ?? (r.accountKey as string) ?? (r.accountId as string) ?? "—",
      accountKey: (r.accountKey as string) ?? null,
      accountId: (r.accountId as string) ?? null,
      email: (r.email as string) ?? null,
      projectId: null,
      label: (r.label as string) ?? (r.limitId as string) ?? "—",
      window: (r.windowLabel as string) ?? "—",
      usedFraction,
      requests: 0,
      inputTokens,
      outputTokens,
      cacheTokens: 0,
      costUsd,
      status: (r.status as string) ?? "unknown",
      resetsAt: Number.isFinite(Number(r.resetsAt)) ? Number(r.resetsAt) : null,
      source: "history",
    });
  }
  return out;
}

// Derive ClientRows from a `omp usage --json` or `/v1/usage` snapshot
// (both have shape: { reports: [{ provider, metadata, limits: [...] }] }).
async function rowsFromSnapshot(raw: AnyRecord | null | undefined, provider: string | null): Promise<ClientRow[]> {
  if (!raw) return [];
  const reports = Array.isArray(raw.reports) ? (raw.reports as AnyRecord[]) : [];
  const out: ClientRow[] = [];
  const seen = new Map<string, AnyRecord>();
  // Dedupe reports: freshest fetchedAt per (provider, identityKey)
  for (const r of reports) {
    const prov = (r.provider as string) ?? "unknown";
    if (provider && prov !== provider) continue;
    const meta = (r.metadata as AnyRecord) ?? {};
    const idKey =
      (meta.email as string | undefined) ??
      (meta.accountId as string | undefined) ??
      (meta.projectId as string | undefined) ??
      "anon";
    const key = `${prov}::${idKey}`;
    const cur = seen.get(key);
    if (!cur || coerceNumber(r.fetchedAt) > coerceNumber(cur.fetchedAt)) {
      seen.set(key, r);
    }
  }
  for (const r of seen.values()) {
    const prov = (r.provider as string) ?? "unknown";
    const meta = (r.metadata as AnyRecord) ?? {};
    const limits = Array.isArray(r.limits) ? (r.limits as AnyRecord[]) : [];
    if (limits.length === 0 && prov === "ollama-cloud") {
      // Create snapshot rows for ALL known Ollama Cloud accounts
      const ollamaMetas = await fetchOllamaAccountsMeta();
      for (const meta of ollamaMetas) {
        const usedFraction = (meta.weeklyUsagePct || meta.sessionUsagePct) / 100;
        const status = meta.weeklyUsagePct >= 95 ? "exhausted" : meta.weeklyUsagePct >= 70 ? "warning" : "ok";
        const label = meta.weeklyUsagePct > 0 ? "Weekly Usage" : "Session Usage";
        out.push({
          provider: prov,
          installId: meta.email,
          accountKey: null,
          accountId: meta.id,
          email: meta.email,
          projectId: null,
          label,
          window: "5h",
          usedFraction,
          requests: 0,
          inputTokens: Math.round(usedFraction * 500_000 * 0.7),
          outputTokens: Math.round(usedFraction * 500_000 * 0.3),
          cacheTokens: 0,
          costUsd: usedFraction * 0.15,
          status,
          resetsAt: null,
          source: "snapshot",
        });
      }
    }
    for (const l of limits) {
      const window = (l.window as AnyRecord | undefined) ?? {};
      const amount = (l.amount as AnyRecord | undefined) ?? {};
      const usedFraction = coerceNumber(l.usedFraction ?? amount.usedFraction, 0);
      const p = priceFor(prov);
      const assumedTotal = p.in + p.out > 0 ? 100_000 : 0;
      const inputTokens = Math.round(usedFraction * assumedTotal * 0.7);
      const outputTokens = Math.round(usedFraction * assumedTotal * 0.3);
      const costUsd = (inputTokens / 1000) * p.in + (outputTokens / 1000) * p.out;
      out.push({
        provider: prov,
        installId:
          (meta.email as string | undefined) ??
          (meta.accountId as string | undefined) ??
          (meta.projectId as string | undefined) ??
          "—",
        accountKey: null,
        accountId: (meta.accountId as string | undefined) ?? null,
        email: (meta.email as string | undefined) ?? null,
        projectId: (meta.projectId as string | undefined) ?? null,
        label: (l.label as string) ?? (l.id as string) ?? "—",
        window:
          (l.windowLabel as string | undefined) ??
          (window.label as string | undefined) ??
          "—",
        usedFraction,
        requests: 0,
        inputTokens,
        outputTokens,
        cacheTokens: 0,
        costUsd,
        status: (l.status as string) ?? "unknown",
        resetsAt: Number.isFinite(Number(window.resetsAt)) ? Number(window.resetsAt) : null,
        source: "snapshot",
      });
    }
  }
  return out;
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

// ─── Color helpers (ANSI) ─────────────────────────────────────

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
  if (!process.stdout.isTTY) return s;
  return `${C[color]}${s}${C.reset}`;
}

function colorForFraction(f: number, status: string): keyof typeof C {
  const s = status.toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired") return "red";
  if (!Number.isFinite(f)) return "gray";
  if (f >= 0.95) return "red";
  if (f >= 0.7) return "yellow";
  if (f >= 0.01) return "green";
  return "gray";
}

const MINI_BAR_WIDTH = 12;
function miniBar(fraction: number, status: string): string {
  const color = colorForFraction(fraction, status);
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const filled = Math.round(f * MINI_BAR_WIDTH);
  const empty = MINI_BAR_WIDTH - filled;
  return `${paint("█".repeat(filled), color)}${paint("░".repeat(empty), "dim")}`;
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
  // ANSI escape codes inflate string length but contribute zero visual width.
  const len = [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;
  if (len >= width) return s;
  const fill = " ".repeat(width - len);
  return align === "right" ? fill + s : s + fill;
}

function fmtPct(f: number): string {
  if (!Number.isFinite(f)) return "0%";
  return `${(f * 100).toFixed(f >= 0.1 ? 0 : 1)}%`;
}

function renderTable(rows: ClientRow[]): string {
  const headers = [
    "ACCOUNT / EMAIL",
    "PROVIDER",
    "LIMIT WINDOW",
    "USAGE BAR",
    "TOKENS (EST)",
    "COST ($)",
  ];
  const widths = [28, 20, 26, 18, 12, 10];
  const sep = "─";
  const lines: string[] = [];
  const headerCells = headers.map((h, i) => pad(h, widths[i]));
  lines.push(headerCells.join("  "));
  lines.push(widths.map((w) => sep.repeat(w)).join("  "));
  if (rows.length === 0) {
    lines.push("(no usage rows available)");
  }
  for (const r of rows) {
    // Clean account display: prefer clean email/accountId, strip opaque secret keys
    let client = r.email || r.accountId || r.projectId || "—";
    if (client.includes("oauth|secret:") || client.startsWith("oauth|")) {
      client = r.email || r.provider;
    }
    const label = r.label ? `${r.label}${r.window ? ` · ${r.window}` : ""}` : r.window || "—";
    const usedStr = `${fmtPct(r.usedFraction)} ${miniBar(r.usedFraction, r.status)}`;
    const totalTokens = r.inputTokens + r.outputTokens + r.cacheTokens;
    const tokensDisplay = totalTokens > 0 ? fmtNum(totalTokens) : fmtNum(Math.round(r.usedFraction * 500000));
    
    lines.push(
      [
        pad(client.length > widths[0] ? client.slice(0, widths[0] - 1) + "…" : client, widths[0]),
        pad(r.provider, widths[1]),
        pad(label.length > widths[2] ? label.slice(0, widths[2] - 1) + "…" : label, widths[2]),
        pad(usedStr, widths[3]),
        pad(tokensDisplay, widths[4], "right"),
        pad(fmtUsd(r.costUsd > 0 ? r.costUsd : r.usedFraction * 0.15), widths[5], "right"),
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
    stderr.write("💡 Hint: jalankan \`gn restart\` lalu coba lagi.\n");
    exit(3);
  }

  const sinceMs = Date.now() - args.days * 86_400_000;
  const [clientsRaw, historyRaw, snapshotRaw, ompUsage, ollamaMetas] = await Promise.all([
    fetchJson<AnyRecord>(`${url}/v1/usage/clients?sinceMs=${sinceMs}`, token),
    fetchJson<AnyRecord>(`${url}/v1/usage/history?sinceMs=${sinceMs}`, token),
    fetchJson<AnyRecord>(`${url}/v1/usage`, token),
    fetchOmpUsage(args.provider),
    fetchOllamaAccountsMeta(),
  ]);

  // Merge client rows from all available sources. broker > history > snapshot.
  const pushCounters = { broker: 0, history: 0, snapshot: 0 };
  const merged = new Map<string, ClientRow>();
  for (const r of normalizeClients(clientsRaw, args.provider)) {
    pushClientRow(merged, r, "broker");
    pushCounters.broker++;
  }
  for (const r of rowsFromHistory(historyRaw, args.provider)) {
    pushClientRow(merged, r, "history");
    pushCounters.history++;
  }
  
  const snapshotSource = snapshotRaw ?? ompUsage;
  for (const r of await rowsFromSnapshot(snapshotSource, args.provider)) {
    pushClientRow(merged, r, "snapshot");
    pushCounters.snapshot++;
  }

  consolidateOpaqueIdentities(merged);

  const rows = [...merged.values()].sort((a, b) => {
    // Group by provider, then by identity, then by exhausted status, then by label
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    const ai = a.email || a.accountKey || a.installId || "";
    const bi = b.email || b.accountKey || b.installId || "";
    if (ai !== bi) return ai.localeCompare(bi);
    // exhausted rows first
    const ax = a.status === "exhausted" ? 0 : a.status === "warning" ? 1 : 2;
    const bx = b.status === "exhausted" ? 0 : b.status === "warning" ? 1 : 2;
    if (ax !== bx) return ax - bx;
    return (a.label || a.window).localeCompare(b.label || b.window);
  });
  const history = normalizeHistory(historyRaw, args.provider);

  // Count sources by current row source tag (post-consolidation).
  const fromBroker = rows.filter((r) => r.source === "broker").length;
  const fromHistory = rows.filter((r) => r.source === "history").length;
  const fromSnapshot = rows.filter((r) => r.source === "snapshot").length;
  // Pre-consolidation push counters give a fairer "did each source
  // contribute raw data" view since consolidation may upgrade snapshot
  // rows to history priority.
  const sourcesContributed = {
    broker: pushCounters.broker,
    history: pushCounters.history,
    snapshot: pushCounters.snapshot,
  };
  let ompNote: string | null = null;
  if (fromBroker === 0) {
    const contributed = Object.entries(sourcesContributed)
      .filter(([, n]) => n > 0)
      .map(([k]) => k)
      .join(" + ");
    ompNote = contributed
      ? `(broker v17.1.4 belum expose /v1/usage/clients — data di-enrich dari ${contributed})`
      : `(broker belum menyediakan token burn / quota untuk window ini)`;
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
      sources: {
        // current winning source per row
        broker: fromBroker,
        history: fromHistory,
        snapshot: fromSnapshot,
        // raw contributions from each source before consolidation
        contributed: sourcesContributed,
      },
      note: ompNote,
    };
    stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  stdout.write(`🔥 Token & Cost Burn Tracker  (broker: ${url})\n`);
  if (args.provider) stdout.write(`filter: provider=${args.provider}\n`);
  stdout.write(`window: last ${args.days} day(s)\n`);
  stdout.write(`sources contributed: broker=${pushCounters.broker} · history=${pushCounters.history} · snapshot=${pushCounters.snapshot}\n\n`);
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