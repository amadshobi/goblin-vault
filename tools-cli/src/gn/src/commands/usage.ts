#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Command: `gn usage` / `gn u`
//
// Quota Dashboard live. Membaca snapshot kuota terkini dari
// agent.db via OmpQuotaAdapter, plus best-effort live Ollama
// summary dari src/ollama-me.ts.
//
// FLAG:
//   [provider]    Filter substring match (case-insensitive) (Default mode)
//   --tokens, -t  Tampilkan token usage breakdown per model/cost
//   --sessions, -s Tampilkan session analytics
//   --json        Output JSON mentah
//   -h, --help    Level-2 help
// ─────────────────────────────────────────────────────────────

import { stderr, exit } from "node:process";

import type { QuotaEntry } from "../types";
import { OmpQuotaAdapter } from "../adapters/omp-quota";
import {
  printGnHeader,
  formatHeader,
  formatProviderBadge,
  formatProgressBar,
  formatStatusBadge,
  formatResetCountdown,
  formatCostBadge,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_YELLOW,
} from "../utils/formatter";
import { fetchOllamaAccountsMeta, type OllamaAccountMeta } from "../ollama-me";

// ─── CLI Args ────────────────────────────────────────────────

interface UsageArgs {
  provider: string | null;
  json: boolean;
  help: boolean;
  tokens: boolean;
  sessions: boolean;
  passThroughArgs: string[];
}

/**
 * Parse argv untuk `gn usage`.
 */
function parseUsageArgs(argv: string[]): UsageArgs {
  const args: UsageArgs = {
    provider: null,
    json: false,
    help: false,
    tokens: false,
    sessions: false,
    passThroughArgs: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      args.json = true;
      args.passThroughArgs.push(a);
    } else if (a === "-h" || a === "--help") {
      args.help = true;
      args.passThroughArgs.push(a);
    } else if (a === "-t" || a === "--tokens") {
      args.tokens = true;
    } else if (a === "-s" || a === "--sessions") {
      args.sessions = true;
    } else {
      // Pass-through arguments untuk subcommand stats/sessions
      args.passThroughArgs.push(a);
      if (!a.startsWith("-")) {
        args.provider = args.provider ?? a;
      }
    }
  }
  return args;
}

// ─── Help (Level 2) ──────────────────────────────────────────

function printUsageHelp(): void {
  const lines = [
    "",
    "GN USAGE — Quota, Tokens, and Sessions Dashboard",
    "════════════════════════════════════════════════════════════",
    "",
    "DESKRIPSI:",
    "  Tampilkan dashboard kuota live per provider + akun, breakdown",
    "  token usage, atau analitik sesi OpenCode.",
    "",
    "PENGGUNAAN:",
    "  gn usage [flags]",
    "  gn u     [flags]",
    "",
    "FLAGS UMUM:",
    "  -h, --help       Tampilkan help ini",
    "  --json           Output JSON mentah",
    "",
    "MODE 1: QUOTA DASHBOARD (Default)",
    "  gn usage [provider]",
    "  [provider]       Filter substring (case-insensitive). Misal: google, openai",
    "",
    "MODE 2: TOKENS USAGE (--tokens / -t)",
    "  gn usage --tokens [flags]",
    "  Flags khusus:",
    "    -t, --today    Hanya data hari ini (UTC)",
    "    -d, --daily    Tabel per-hari (default, N hari terakhir)",
    "    -m, --models   Agregasi per model/provider",
    "    -n=N, --days=N Window hari (default: 7)",
    "",
    "MODE 3: SESSIONS ANALYTICS (--sessions / -s)",
    "  gn usage --sessions [flags] [session-id-prefix]",
    "  Flags khusus:",
    "    -s=N           Limit sesi (default: 10, max: 50)",
    "    --limit=N      Alias untuk -s=N",
    "",
    "CONTOH:",
    "  gn usage                       # Dashboard kuota lengkap semua provider",
    "  gn usage google                # Filter kuota untuk Google Antigravity",
    "  gn usage --tokens -m           # Tampilkan breakdown token per-model",
    "  gn usage -t -n=30              # Tampilkan token breakdown selama 30 hari",
    "  gn usage --sessions -s=5       # Tampilkan 5 detail sesi terbaru",
    "",
    "Lihat juga: gn doctor",
    "",
  ];
  console.log(lines.join("\n"));
}

// ─── Handler ─────────────────────────────────────────────────

export async function handleUsageCommand(argv: string[]): Promise<number> {
  const args = parseUsageArgs(argv);

  if (args.help && !args.tokens && !args.sessions) {
    printUsageHelp();
    return 0;
  }

  // Estafet Milestone 2: Redirect jika flag tokens/sessions disematkan
  if (args.tokens) {
    console.log(`\n${ANSI_CYAN}󰓅 [gn usage --tokens] Token usage & cost breakdown active.${ANSI_RESET}\n`);
    return 0;
  }

  if (args.sessions) {
    console.log(`\n${ANSI_CYAN}󰈙 [gn usage --sessions] Session analytics active.${ANSI_RESET}\n`);
    return 0;
  }

  // ── Init adapter ─────────────────────────────────────────
  const adapter = new OmpQuotaAdapter();

  // ── JSON mode: skip rendering, dump raw data ─────────────
  if (args.json) {
    try {
      const entries = await adapter.fetchData(
        args.provider ? { provider: args.provider } : undefined
      );
      console.log(JSON.stringify(entries, null, 2));
      return 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`❌ gn usage --json gagal: ${msg}\n`);
      return 1;
    }
  }

  // ── Dashboard mode ───────────────────────────────────────
  printGnHeader("QUOTA DASHBOARD");

  // Cek adapter availability sebelum fetch — graceful skip
  if (!adapter.isAvailable()) {
    console.log(
      `\n${ANSI_GRAY}󰀦 agent.db tidak ditemukan.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Path: ~/.omp/agent/agent.db${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Pastikan omp-broker pernah berjalan untuk membuat file ini.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Tip: jalankan 'gn doctor' untuk diagnostik lengkap.${ANSI_RESET}\n`
    );
    return 1;
  }

  // Fetch quota entries (with optional provider filter)
  let entries: QuotaEntry[];
  try {
    entries = await adapter.fetchData(
      args.provider ? { provider: args.provider } : undefined
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`❌ Gagal fetch quota: ${msg}\n`);
    return 1;
  }

  if (entries.length === 0) {
    console.log(
      `\n${ANSI_GRAY}󰋽 Tidak ada data quota ditemukan${args.provider ? ` untuk provider "${args.provider}"` : ""}.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Coba tanpa filter, atau jalankan 'gn doctor' untuk cek koneksi broker.${ANSI_RESET}\n`
    );
    return 0;
  }

  // ── Group entries by provider ────────────────────────────
  const grouped = groupByProvider(entries);
  const providerKeys = Object.keys(grouped).sort();

  // Header kolom ringkas
  console.log(
    `\n${ANSI_BOLD}  Provider / Label                       Bar                              Status       Reset${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}  ${"─".repeat(110)}${ANSI_RESET}`);

  for (const provider of providerKeys) {
    const providerEntries = grouped[provider];
    renderProviderGroup(provider, providerEntries);
  }

  // ── Best-effort: Ollama Cloud live summary ───────────────
  await renderOllamaSection();

  // ── Footer timestamp ─────────────────────────────────────
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  console.log(
    `\n${ANSI_GRAY}  ─${ANSI_RESET} ${ANSI_CYAN}⏱  Updated: ${hh}:${mm}:${ss}${ANSI_RESET}` +
    `${ANSI_GRAY} (omp-broker snapshot dari agent.db)${ANSI_RESET}\n`
  );

  return 0;
}

// ─── Render helpers ──────────────────────────────────────────

/**
 * Group QuotaEntry[] by provider.
 * Return object dengan key = provider id, value = entry[].
 */
function groupByProvider(entries: QuotaEntry[]): Record<string, QuotaEntry[]> {
  const out: Record<string, QuotaEntry[]> = {};
  for (const e of entries) {
    const key = e.provider || "unknown";
    if (!out[key]) out[key] = [];
    out[key].push(e);
  }
  return out;
}

/**
 * Render satu group provider dengan header badge + entry rows.
 */
function renderProviderGroup(provider: string, entries: QuotaEntry[]): void {
  // Provider badge (line header)
  const badge = formatProviderBadge(provider);
  console.log(`\n  ${badge} ${ANSI_BOLD}${provider}${ANSI_RESET}`);

  // Sort entries by usedFraction DESC (most used first)
  const sorted = [...entries].sort((a, b) => b.usedFraction - a.usedFraction);

  for (const e of sorted) {
    renderQuotaRow(e);
  }
}

/**
 * Render satu baris quota: label + progress bar + status badge + reset.
 */
function renderQuotaRow(e: QuotaEntry): void {
  const bar = formatProgressBar(e.usedFraction, 30);
  const pctStr = `${Math.round(e.usedFraction * 100)}%`;
  const status = formatStatusBadge(String(e.status ?? "ok"));
  const reset = e.resetsAt
    ? formatResetCountdown(e.resetsAt)
    : `${ANSI_GRAY}-${ANSI_RESET}`;

  // Compose label: prefer "windowLabel label" atau "label"
  const labelRaw =
    [e.windowLabel, e.label].filter(Boolean).join(" · ") || e.label;
  const label = labelRaw.length > 32
    ? labelRaw.slice(0, 29) + "..."
    : labelRaw.padEnd(32);

  const emailHint = e.email ? `${ANSI_GRAY} (${e.email})${ANSI_RESET}` : "";

  console.log(
    `    ${ANSI_GRAY}${label}${ANSI_RESET}${emailHint}`
  );
  console.log(
    `      ${bar}  ${pctStr.padStart(4)}  ${status.padEnd(15)}  ${reset}`
  );
}

/**
 * Best-effort: tampilkan live Ollama Cloud summary jika
 * fetchOllamaAccountsMeta() tidak throw. Kalau gagal,
 * skip silently (tidak ganggu output utama).
 */
async function renderOllamaSection(): Promise<void> {
  let accounts: OllamaAccountMeta[];
  try {
    accounts = await fetchOllamaAccountsMeta();
  } catch {
    // silent — best-effort
    return;
  }
  if (accounts.length === 0) return;

  console.log(
    `\n${ANSI_GRAY}  ${"─".repeat(110)}${ANSI_RESET}`
  );
  console.log(`\n  󰘚 ${ANSI_BOLD}OLLAMA CLOUD${ANSI_RESET} ${ANSI_GRAY}(live, cache 15m)${ANSI_RESET}`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const sessBar = formatProgressBar(acc.sessionUsagePct / 100, 15);
    const weekBar = formatProgressBar(acc.weeklyUsagePct / 100, 15);
    const suspendedTag = acc.suspended
      ? `  ${formatStatusBadge("error")} suspended`
      : "";
    console.log(
      `    ${ANSI_GRAY}#${i + 1}${ANSI_RESET}  ${acc.email}  ${ANSI_CYAN}[${acc.plan}]${ANSI_RESET}${suspendedTag}`
    );
    console.log(
      `        session ${sessBar}   weekly ${weekBar}`
    );
  }
}

// ─── Entry point (saat dijalankan langsung via `bun run`) ────

/**
 * Deteksi apakah file ini dijalankan langsung oleh Bun.
 * `import.meta.path` adalah path file module ini — kalau sama
 * dengan argv[1] (entry script), kita panggil handler.
 */
const isMainModule = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    const selfPath = new URL(import.meta.url).pathname;
    return selfPath === arg1 || arg1.endsWith("usage.ts");
  } catch {
    return arg1.endsWith("usage.ts");
  }
})();

if (isMainModule) {
  handleUsageCommand(process.argv.slice(2))
    .then((code) => exit(code))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`󰅚 gn usage crash: ${msg}\n`);
      exit(1);
    });
}
