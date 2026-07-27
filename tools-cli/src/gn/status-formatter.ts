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
  resetsAt?: number | null;
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
  const resetsAt = Number(window.resetsAt ?? raw.resetsAt ?? NaN);
  return {
    id: (raw.id as string) ?? "unknown",
    label: (raw.label as string) ?? "—",
    windowLabel,
    usedFraction,
    status: (raw.status as string) ?? "unknown",
    window,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
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

const BAR_WIDTH = 28;

function colorForFraction(fraction: number, status?: string): keyof typeof C {
  const s = (status ?? "").toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired") return "red";
  if (s === "disabled") return "red";
  if (!Number.isFinite(fraction)) return "gray";
  if (fraction >= 0.95) return "red";
  if (fraction >= 0.7) return "yellow";
  if (fraction >= 0.01) return "green";
  return "gray";
}

function dotFor(status: string, fraction: number = 0): { glyph: string; color: keyof typeof C } {
  const color = colorForFraction(fraction, status);
  const s = status.toLowerCase();
  if (s === "exhausted" || s === "blocked" || s === "expired" || s === "disabled") {
    return { glyph: "✗", color: "red" };
  }
  if (color === "gray") return { glyph: "○", color: "gray" };
  if (color === "yellow") return { glyph: "●", color: "yellow" };
  if (color === "red") return { glyph: "●", color: "red" };
  return { glyph: "●", color: "green" };
}

function renderProgressBar(fraction: number, status: string): string {
  const color = colorForFraction(fraction, status);
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const filled = Math.round(f * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const filledStr = "█".repeat(filled);
  const emptyStr = "░".repeat(empty);
  // Split so empty portion renders dim and filled renders in status color.
  return `${paint(filledStr, color)}${paint(emptyStr, "dim")}`;
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

function countdownTo(ms: number): string {
  const diff = ms - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "resetting…";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// ─── Renderers ────────────────────────────────────────────────

function fmtPct(f: number): string {
  if (!Number.isFinite(f)) return "0%";
  return `${(f * 100).toFixed(f >= 0.1 ? 0 : 1)}%`;
}

function renderProviderHeader(provider: string, accountCount: number, hasError: boolean, hasDisabled: boolean): string[] {
  const color = hasError ? "red" : hasDisabled ? "yellow" : "green";
  const glyph = hasError ? "✗" : hasDisabled ? "○" : "●";
  const lines: string[] = [];
  const accent = `${glyph} ${provider}`;
  const accountTag = accountCount > 0 ? `  ${accountCount} account${accountCount > 1 ? "s" : ""}` : "";
  lines.push(`${paint(accent, color)}${paint(accountTag, "dim")}`);
  return lines;
}

function renderAccountHeader(metadata: AnyRecord): string {
  const email =
    (metadata.email as string | undefined) ??
    (metadata.accountId as string | undefined) ??
    (metadata.projectId as string | undefined) ??
    "—";
  const plan = (metadata.plan as string | undefined) ?? (metadata.planType as string | undefined);
  const tag = plan ? ` ${paint(`[${plan}]`, "dim")}` : "";
  return `  ${paint("▸", "dim")} ${paint(email, "bold")}${tag}`;
}

function renderLimitRow(metadata: AnyRecord, limit: LimitRow): string[] {
  const bar = renderProgressBar(limit.usedFraction, limit.status);
  const dot = dotFor(limit.status, limit.usedFraction);
  const pct = fmtPct(limit.usedFraction);
  const label = (limit.label || limit.windowLabel || "—").padEnd(20);
  const resetPart = limit.resetsAt && Number.isFinite(limit.resetsAt)
    ? `${paint("·", "dim")} resets in ${paint(countdownTo(limit.resetsAt).padEnd(10), "dim")}`
    : "".padEnd(24);
  const statusTag = limit.status && limit.status !== "ok"
    ? ` ${paint(`(${limit.status})`, dot.color)}`
    : "";
  return [
    `    ${paint(dot.glyph, dot.color)} ${paint(label, "bold")} ${bar}  ${paint(pct.padStart(6), dot.color)} used ${resetPart}${statusTag}`,
  ];
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

// Group reports by provider. Each Report is one account (identified by
  // metadata.email/accountId/projectId). We keep ALL reports per provider
  // so we can render per-account progress bars; OMP emits many duplicate
  // snapshots for the same account, so we dedupe by picking the freshest
  // per (provider, identityKey).
  const latestPerAccount = new Map<string, ReportRow>();
  let anonIdx = 1;
  for (const r of payload.reports ?? []) {
    if (providerFilter && r.provider !== providerFilter) continue;
    const meta = (r.metadata as AnyRecord) ?? {};
    const hasExplicitId = meta.email || meta.accountId || meta.projectId;
    const idKey =
      (meta.email as string | undefined) ??
      (meta.accountId as string | undefined) ??
      (meta.projectId as string | undefined) ??
      `anon_${anonIdx++}`;
    const key = `${r.provider}::${idKey}`;
    const existing = latestPerAccount.get(key);
    if (!existing || (hasExplicitId && (r.fetchedAt ?? 0) > (existing.fetchedAt ?? 0))) {
      latestPerAccount.set(key, r);
    }
  }

  // Group by provider for header rendering
  const accountsByProvider = new Map<string, ReportRow[]>();
  for (const [key, r] of latestPerAccount) {
    const prov = r.provider;
    const arr = accountsByProvider.get(prov) ?? [];
    arr.push(r);
    accountsByProvider.set(prov, arr);
  }

  for (const r of latestPerAccount.values()) {
    r.limits = (r.limits ?? []).map((l) => normalizeLimit(l));
  }

  const blocks: string[] = [];

  for (const [provider, accounts] of accountsByProvider) {
    const providerDisabled = (payload.disabledCredentials ?? []).filter((d) => d.provider === provider);
    const anyError = accounts.some((r) => Boolean((r as AnyRecord).error));
    const headerLines = renderProviderHeader(provider, accounts.length, anyError, providerDisabled.length > 0);

    const lines: string[] = [...headerLines];
    for (const account of accounts) {
      lines.push(renderAccountHeader(account.metadata ?? {}));
      for (const l of account.limits ?? []) {
        lines.push(...renderLimitRow(account.metadata ?? {}, l));
      }
    }
    for (const d of providerDisabled) {
      lines.push(renderDisabled(d));
    }

    const cap = (payload.capacity ?? {})[provider];
    const capLine = renderCapacity(cap ?? []);
    if (capLine) lines.push(capLine);

    blocks.push(lines.join("\n"));
  }

  // Disabled summary across all providers (only when no per-provider blocks)
  const allDisabled = (payload.disabledCredentials ?? []).filter((d) => !providerFilter || d.provider === providerFilter);
  if (allDisabled.length > 0 && accountsByProvider.size === 0) {
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