#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus - Status Formatter
//
// Format JSON output dari `omp usage --json` jadi visual status
// report yang lebih "pro" — pakai `gum style` kalau ada, fallback
// ke ANSI/plain kalau tidak.
//
// Format:
//   ● google-antigravity   3/3 accounts   status mixed
//     ▸ email@x.com          OK  12% used (Weekly)
//     ▸ email@y.com          ⚠  78% used (Daily)
//     ✗ email@z.com — disabled 3d ago: Grant expired (re-login to restore)
//     capacity: 7d → 2/2 accounts used (0× quota left)
//
//   ● github-copilot
//     ▸ goblin-vault          OK  Monthly
//     capacity: Monthly → 0/1 accounts used (1× quota left)
//
// Input:
//   argv[2]  optional --provider=<id>
//   stdin    JSON output of `omp usage --json`
// ─────────────────────────────────────────────────────────────

import { argv, env, exit, stdin, stdout, stderr } from "node:process";

type AnyRecord = Record<string, unknown>;

interface LimitRow {
  id: string;
  label: string;
  windowLabel: string;
  usedFraction: number;
  status: string;
  window?: AnyRecord;
}

interface ReportRow {
  provider: string;
  fetchedAt: number | null;
  limits: LimitRow[];
  metadata: AnyRecord;
}

interface DisabledRow {
  provider: string;
  email?: string | null;
  accountId?: string | null;
  reason?: string | null;
  disabledAt?: number | null;
}

interface CapacityRow {
  window: string;
  accounts: number;
  usedAccounts: number;
  remainingAccounts: number;
}

interface UsagePayload {
  generatedAt: number | null;
  reports: ReportRow[];
  disabledCredentials: DisabledRow[];
  accountsWithoutUsage: AnyRecord[];
  capacity: Record<string, CapacityRow[]>;
}

// ─── Normalizer: OMP usage limit shape ────────────────────────
// OMP emits `windowLabel` and `usedFraction` directly in some versions,
// but v17.1.4 nests them under `window.label` and `amount.usedFraction`
// (with `amount.used`/`amount.limit` as raw integers). Normalize once.

function normalizeLimit(raw: AnyRecord): LimitRow {
  const window = (raw.window as AnyRecord | undefined) ?? {};
  const amount = (raw.amount as AnyRecord | undefined) ?? {};
  const windowLabel =
    (raw.windowLabel as string | undefined) ??
    (window.label as string | undefined) ??
    (raw.id as string | undefined)?.split(":").pop() ??
    "—";
  let usedFraction = Number(raw.usedFraction ?? amount.usedFraction ?? NaN);
  if (!Number.isFinite(usedFraction)) {
    const used = Number(amount.used ?? 0);
    const limit = Number(amount.limit ?? 0);
    usedFraction = limit > 0 ? used / limit : 0;
  }
  return {
    id: (raw.id as string) ?? "unknown",
    label: (raw.label as string) ?? "—",
    windowLabel,
    usedFraction,
    status: (raw.status as string) ?? "unknown",
    window,
  };
}

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

// ─── Status dot ───────────────────────────────────────────────

function dotFor(status: string): { glyph: string; color: keyof typeof C } {
  const s = status.toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired") return { glyph: "✗", color: "red" };
  if (s === "warning" || s === "degraded" || s === "throttled") return { glyph: "○", color: "yellow" };
  if (s === "ok" || s === "active" || s === "healthy") return { glyph: "●", color: "green" };
  if (s === "unknown") return { glyph: "○", color: "gray" };
  return { glyph: "●", color: "cyan" };
}

// ─── Time helper ──────────────────────────────────────────────

function ago(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Renderers ────────────────────────────────────────────────

function fmtPct(f: number): string {
  if (!Number.isFinite(f)) return "0%";
  return `${(f * 100).toFixed(f >= 0.1 ? 0 : 1)}%`;
}

function renderProviderHeader(provider: string, accountCount: number, hasError: boolean, hasDisabled: boolean): string[] {
  const dot = hasError ? dotFor("blocked") : hasDisabled ? dotFor("warning") : dotFor("ok");
  const lines: string[] = [];
  const accent = `${dot.glyph} ${provider}`;
  const accountTag = accountCount > 0 ? `  ${accountCount} account${accountCount > 1 ? "s" : ""}` : "";
  lines.push(`${paint(accent, dot.color)}${paint(accountTag, "dim")}`);
  return lines;
}

function renderLimitRow(metadata: AnyRecord, limit: LimitRow): string {
  const email =
    (metadata.email as string | undefined) ??
    (metadata.accountId as string | undefined) ??
    (metadata.projectId as string | undefined) ??
    "—";
  const d = dotFor(limit.status);
  const pct = fmtPct(limit.usedFraction);
  const windowLabel = limit.windowLabel || (limit.window?.label as string | undefined) || "—";
  const tail = `(${windowLabel})`;
  return `  ${paint("▸", "dim")} ${padRight(email, 32)} ${paint(d.glyph, d.color)}  ${pct.padStart(5)} used ${paint(tail, "dim")}`;
}

function renderDisabled(d: DisabledRow): string {
  const id = d.email ?? d.accountId ?? `(${d.provider})`;
  const when = typeof d.disabledAt === "number" ? ago(d.disabledAt) : "recently";
  const reason = d.reason ?? "disabled";
  return `  ${paint("✗", "red")} ${padRight(id, 32)} ${paint(`disabled ${when}`, "red")} ${paint(`(${reason}; re-login to restore)`, "dim")}`;
}

function renderCapacity(cap: CapacityRow[]): string {
  if (!cap || cap.length === 0) return "";
  return cap
    .map((c) => {
      const ratio = c.accounts > 0 ? c.remainingAccounts / c.accounts : 0;
      const left = `${(c.remainingAccounts).toFixed(2)}× quota left`;
      return `  ${paint("capacity:", "dim")} ${c.window.padEnd(8)} → ${paint(`${c.usedAccounts.toFixed(2)}/${c.accounts} accounts used`, "magenta")} (${paint(left, ratio > 0.5 ? "green" : ratio > 0 ? "yellow" : "red")})`;
    })
    .join("\n");
}

function renderAccountNoUsage(item: AnyRecord): string {
  const id = (item.email as string | undefined) ?? (item.accountId as string | undefined) ?? "—";
  return `  ${paint("○", "gray")} ${padRight(id, 32)} ${paint("(no usage data yet)", "dim")}  ${paint(`[${item.provider}]`, "dim")}`;
}

function padRight(s: string, n: number): string {
  const visible = [...s].length;
  if (visible >= n) return s;
  return s + " ".repeat(n - visible);
}

// ─── Gum integration ──────────────────────────────────────────

async function renderWithGum(blocks: string[]): Promise<boolean> {
  if (!process.env.GN_FORCE_PLAIN) {
    try {
      const proc = Bun.spawn({
        cmd: ["gum", "style", "--foreground", "212", "--border-foreground", "99", "--border", "rounded", "--padding", "0 2", "--margin", "0 0", "--width", "80"],
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      const writer = proc.stdin.getWriter();
      await writer.write(new TextEncoder().encode(blocks.join("\n\n")));
      await writer.close();
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      if (proc.exitCode === 0) {
        stdout.write(out + "\n");
        return true;
      }
      if (err) stderr.write(err);
    } catch {
      // fall through
    }
  }
  return false;
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Read provider filter from argv
  let providerFilter: string | null = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      stdout.write("Usage: status-formatter.ts [--provider=<id>]  (reads JSON from stdin)\n");
      exit(0);
    }
    if (a.startsWith("--provider=")) {
      providerFilter = a.slice("--provider=".length);
    }
  }

  // Read JSON from stdin
  const raw = await new Response(stdin).text();
  if (!raw.trim()) {
    stderr.write("🔥 [Goblin Roast Error] No JSON received on stdin.\n");
    exit(2);
  }

  let payload: UsagePayload;
  try {
    payload = JSON.parse(raw) as UsagePayload;
  } catch (err) {
    stderr.write(`🔥 [Goblin Roast Error] Failed to parse JSON: ${(err as Error).message}\n`);
    exit(2);
  }

  // Group reports by provider
  const grouped = new Map<string, ReportRow[]>();
  for (const r of payload.reports ?? []) {
    if (providerFilter && r.provider !== providerFilter) continue;
    const arr = grouped.get(r.provider) ?? [];
    arr.push(r);
    grouped.set(r.provider, arr);
  }

  const blocks: string[] = [];

  // Per-provider sections.
  // OMP emits one Report per (provider, fetchedAt) snapshot. Multiple
  // snapshots for the same provider can appear in `reports`. We dedupe
  // by picking the freshest report per provider, then render its limits
  // (de-duped by limit.id since a single snapshot shouldn't have dupes).
  const latestPerProvider = new Map<string, ReportRow>();
  for (const r of payload.reports ?? []) {
    if (providerFilter && r.provider !== providerFilter) continue;
    const existing = latestPerProvider.get(r.provider);
    if (!existing || (r.fetchedAt ?? 0) > (existing.fetchedAt ?? 0)) {
      latestPerProvider.set(r.provider, r);
    }
  }

  // Normalize each freshest report: derive windowLabel + usedFraction when missing
  for (const r of latestPerProvider.values()) {
    r.limits = (r.limits ?? []).map((l) => normalizeLimit(l));
  }

  for (const [provider, r] of latestPerProvider) {
    const providerDisabled = (payload.disabledCredentials ?? []).filter((d) => d.provider === provider);
    const anyError = Boolean((r as AnyRecord).error);
    const headerLines = renderProviderHeader(provider, 1, anyError, providerDisabled.length > 0);

    const lines: string[] = [...headerLines];
    for (const l of r.limits ?? []) {
      lines.push(renderLimitRow(r.metadata ?? {}, l));
    }
    for (const d of providerDisabled) {
      lines.push(renderDisabled(d));
    }

    const cap = (payload.capacity ?? {})[provider];
    const capLine = renderCapacity(cap ?? []);
    if (capLine) lines.push(capLine);

    blocks.push(lines.join("\n"));
  }

  // Disabled summary across all providers
  const allDisabled = (payload.disabledCredentials ?? []).filter((d) => !providerFilter || d.provider === providerFilter);
  if (allDisabled.length > 0 && grouped.size === 0) {
    const lines = [paint("✗ Disabled Credentials", "red")];
    for (const d of allDisabled) lines.push(renderDisabled(d));
    blocks.push(lines.join("\n"));
  }

  // Accounts without usage
  const noUsage = (payload.accountsWithoutUsage ?? []).filter((a) => !providerFilter || (a.provider as string) === providerFilter);
  if (noUsage.length > 0) {
    const lines = [paint("○ Accounts without usage data", "gray")];
    for (const item of noUsage) lines.push(renderAccountNoUsage(item));
    blocks.push(lines.join("\n"));
  }

  if (blocks.length === 0) {
    stdout.write(paint("ℹ️  No usage data available. Run `gn sync` then re-poll broker.", "dim") + "\n");
    return;
  }

  // Try gum, fall back to plain
  const rendered = await renderWithGum(blocks);
  if (!rendered) {
    stdout.write(blocks.join("\n\n") + "\n");
  }
}

main().catch((err) => {
  stderr.write(`🔥 [Goblin Roast Error] formatter failed: ${(err as Error).message}\n`);
  exit(1);
});