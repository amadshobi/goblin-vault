#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Command: `gn stats` / `gn s`
//
// Token & cost recap dari OpenCode sessions. PRIMARY: OpenCodeAdapter.
// FALLBACK: OmpNativeAdapter (untuk user yang pakai native OMP CLI
//           tanpa OpenCode TUI).
//
// ARSITEKTUR (architect section 6.3):
//   - TIDAK ADA query SQL langsung di sini untuk data utama.
//   - Semua lewat OpenCodeAdapter / OmpNativeAdapter.
//   - Pengecualian: daily breakdown (per-hari) butuh query
//     GROUP BY date yang tidak di-expose adapter. Itu diambil
//     via safeQuery (read-only helper) — bukan `bun:sqlite` raw.
//
// FLAG:
//   -t, --today       Ringkasan hari ini saja
//   -d, --daily       Tabel per hari (default, N hari terakhir)
//   -m, --models      Agregasi per model/provider
//   -n=N, --days=N    Window hari (default: 7)
//       --json        Output JSON mentah
//   -h, --help        Level-2 help
// ─────────────────────────────────────────────────────────────

import { stderr, exit } from "node:process";

import type {
  ModelUsageSummary,
  StatsSummary,
  OmpNativeMessageSummary,
} from "../types";
import { OpenCodeAdapter } from "../adapters/opencode";
import { OmpNativeAdapter } from "../adapters/omp-native";
import { getOpenCodeDb, safeQuery } from "../utils/db";
import {
  printGnHeader,
  formatNumber,
  formatCost,
  formatTable,
  formatProviderBadge,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_GREEN,
} from "../utils/formatter";

// ─── CLI Args ────────────────────────────────────────────────

interface StatsArgs {
  today: boolean;
  daily: boolean;
  models: boolean;
  days: number;
  json: boolean;
  help: boolean;
}

function parseStatsArgs(argv: string[]): StatsArgs {
  const args: StatsArgs = {
    today: false,
    daily: false,
    models: false,
    days: 7,
    json: false,
    help: false,
  };
  for (const a of argv) {
    if (a === "--today" || a === "-t") args.today = true;
    else if (a === "--daily" || a === "-d") args.daily = true;
    else if (a === "--models" || a === "-m") args.models = true;
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a.startsWith("-n=")) {
      const n = parseInt(a.slice(3), 10);
      if (Number.isFinite(n) && n > 0) args.days = n;
    } else if (a.startsWith("--days=")) {
      const n = parseInt(a.slice(7), 10);
      if (Number.isFinite(n) && n > 0) args.days = n;
    }
  }
  return args;
}

// ─── Help (Level 2) ──────────────────────────────────────────

function printStatsHelp(): void {
  const lines = [
    "",
    "GN STATS — Token & Cost Recap",
    "════════════════════════════════════════════════════════════",
    "",
    "DESKRIPSI:",
    "  Tampilkan rekap token & biaya dari sesi OpenCode. Sumber",
    "  data: opencode.db (primary) atau stats.db OMP (fallback).",
    "",
    "PENGGUNAAN:",
    "  gn stats [flags]",
    "  gn s     [flags]",
    "",
    "FLAGS:",
    "  -t, --today      Hanya data hari ini (UTC)",
    "  -d, --daily      Tabel per-hari (default, N hari terakhir)",
    "  -m, --models     Agregasi per model/provider",
    "  -n=N             Window hari (default: 7, digunakan oleh --daily)",
    "      --days=N     Alias untuk -n=N",
    "      --json       Output JSON mentah",
    "  -h, --help       Tampilkan help ini",
    "",
    "OUTPUT LAYOUT:",
    "  ┌─ Banner ASCII",
    "  ├─ 📅 7 DAYS — Daily Breakdown",
    "  │     Date        Sessions  Input Tok   Output Tok  Cost",
    "  │     2026-08-03       12    1,234,567    456,789   $3.21",
    "  ├─ 🤖 BY MODEL — Provider/Model Breakdown",
    "  │     Model                  Sessions  Tokens Total  Cost",
    "  └─ Footer dengan total window",
    "",
    "CONTOH:",
    "  gn stats                    # Default: 7-day daily breakdown",
    "  gn stats -m                 # Tampilkan per-model aggregation",
    "  gn stats --today            # Ringkasan hari ini",
    "  gn stats -n=30 -m           # 30-day window + model breakdown",
    "  gn stats --json | jq .      # Pipe ke jq untuk scripting",
    "",
    "FALLBACK:",
    "  Jika opencode.db tidak ada, otomatis fallback ke stats.db",
    "  (OMP native). Pesan informatif akan ditampilkan.",
    "",
  ];
  console.log(lines.join("\n"));
}

// ─── Handler ─────────────────────────────────────────────────

/**
 * Handler utama untuk command `gn stats`.
 *
 * @param argv  Argumen setelah subcommand
 * @returns Exit code: 0 sukses, 1 error
 */
export async function handleStatsCommand(argv: string[]): Promise<number> {
  const args = parseStatsArgs(argv);

  if (args.help) {
    printStatsHelp();
    return 0;
  }

  // Inisialisasi adapters
  const opencode = new OpenCodeAdapter();
  const native = new OmpNativeAdapter();

  // Tentukan mode rendering
  // Default: --daily (sesuai architect spec section 6.3)
  const showDaily = args.daily || (!args.today && !args.models);
  const showModels = args.models;
  const showToday = args.today;

  // ── JSON mode ─────────────────────────────────────────────
  if (args.json) {
    const payload: Record<string, unknown> = {
      window: { days: args.days },
      today: null,
      daily: [],
      models: [],
    };
    if (opencode.isAvailable()) {
      if (showToday) {
        const todayModels = opencode.fetchModelUsageSummary(true);
        payload.today = {
          models: todayModels,
          totals: sumTotals(todayModels),
        };
      }
      if (showDaily) {
        payload.daily = fetchDailyBreakdown(args.days);
      }
      if (showModels) {
        payload.models = opencode.fetchModelUsageSummary(false);
      }
    } else if (native.isAvailable()) {
      const messages = await native.getMessagesSummary();
      payload.models = mapNativeToModels(messages);
    }
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  // ── Render mode ───────────────────────────────────────────
  printGnHeader("TOKEN & COST RECAP");

  // Cek adapter availability
  const useOpencode = opencode.isAvailable();
  const useNative = !useOpencode && native.isAvailable();

  if (!useOpencode && !useNative) {
    console.log(
      `\n${ANSI_GRAY}⚠️  Tidak ada data source tersedia.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   - opencode.db (${getOpenCodeDb()})${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   - stats.db (OMP native)${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Jalankan OpenCode atau OMP CLI untuk membuat data.${ANSI_RESET}\n`
    );
    return 1;
  }

  if (!useOpencode && useNative) {
    console.log(
      `\n${ANSI_GRAY}ℹ️  opencode.db tidak ada — fallback ke OMP native stats.${ANSI_RESET}`
    );
  }

  // ── Render: Today Summary ─────────────────────────────────
  if (showToday) {
    await renderTodaySection(useOpencode ? opencode : null, native);
  }

  // ── Render: Daily Breakdown ───────────────────────────────
  if (showDaily) {
    renderDailySection(args.days);
  }

  // ── Render: Models Breakdown ──────────────────────────────
  if (showModels) {
    await renderModelsSection(useOpencode ? opencode : null, native);
  }

  // ── Footer ────────────────────────────────────────────────
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  console.log(
    `\n${ANSI_GRAY}  ─${ANSI_RESET} ${ANSI_CYAN}⏱  Generated: ${hh}:${mm}:${ss}${ANSI_RESET}` +
    `${ANSI_GRAY} (${useOpencode ? "opencode.db" : "stats.db (fallback)"})${ANSI_RESET}\n`
  );

  return 0;
}

// ─── Render sections ─────────────────────────────────────────

/**
 * Render ringkasan hari ini (UTC). Pakai OpenCodeAdapter jika
 * tersedia; kalau fallback ke native, tampilkan partial info.
 */
async function renderTodaySection(
  opencode: OpenCodeAdapter | null,
  native: OmpNativeAdapter
): Promise<void> {
  console.log(
    `\n${ANSI_BOLD}  📅 TODAY (UTC)${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}  ${"─".repeat(80)}${ANSI_RESET}`);

  if (opencode) {
    const models = opencode.fetchModelUsageSummary(true);
    if (models.length === 0) {
      console.log(
        `  ${ANSI_GRAY}ℹ️  Belum ada sesi hari ini.${ANSI_RESET}`
      );
      return;
    }
    const totals = sumTotals(models);
    console.log(
      `  ${ANSI_BOLD}Sessions: ${formatNumber(totals.sessionCount)}${ANSI_RESET}` +
      `   Input: ${ANSI_CYAN}${formatNumber(totals.totalTokensInput)}${ANSI_RESET}` +
      `   Output: ${ANSI_CYAN}${formatNumber(totals.totalTokensOutput)}${ANSI_RESET}` +
      `   Cost: ${ANSI_GREEN}${formatCost(totals.totalCost)}${ANSI_RESET}`
    );
    // Per-model breakdown untuk today
    const headers = ["Provider/Model", "Sessions", "Tokens", "Cost"];
    const rows = models.map((m) => [
      `${m.provider}/${m.modelId.split("/").slice(1).join("/")}`,
      String(m.sessionCount),
      formatNumber(m.totalTokens),
      formatCost(m.totalCost),
    ]);
    console.log(`\n${formatTable(headers, rows)}`);
  } else {
    // Fallback: native tidak ada konsep "today" spesifik,
    // tampilkan total dari semua messages summary
    const messages = await native.getMessagesSummary();
    if (messages.length === 0) {
      console.log(`  ${ANSI_GRAY}ℹ️  Belum ada data.${ANSI_RESET}`);
      return;
    }
    const totals = sumNativeTotals(messages);
    console.log(
      `  ${ANSI_BOLD}Messages: ${formatNumber(totals.totalRequests)}${ANSI_RESET}` +
      `   Cost: ${ANSI_GREEN}${formatCost(totals.totalCost)}${ANSI_RESET}`
    );
  }
}

/**
 * Render tabel daily breakdown via safeQuery (per-day aggregation
 * tidak di-expose adapter; safeQuery sudah enforce read-only).
 */
function renderDailySection(days: number): void {
  console.log(
    `\n${ANSI_BOLD}  📅 ${days} DAYS — Daily Breakdown${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}  ${"─".repeat(80)}${ANSI_RESET}`);

  const rows = fetchDailyBreakdown(days);
  if (rows.length === 0) {
    console.log(
      `  ${ANSI_GRAY}ℹ️  Belum ada data dalam window ${days} hari.${ANSI_RESET}`
    );
    return;
  }

  // Sort ASC by date (terlama → terbaru) untuk chronological reading
  rows.sort((a, b) => a.day.localeCompare(b.day));

  const tableRows = rows.map((r) => [
    r.day,
    String(r.session_count),
    formatNumber(r.total_input),
    formatNumber(r.total_output),
    formatCost(r.total_cost),
  ]);

  // Hitung total
  const totals = rows.reduce(
    (acc, r) => ({
      session_count: acc.session_count + r.session_count,
      total_input: acc.total_input + r.total_input,
      total_output: acc.total_output + r.total_output,
      total_cost: acc.total_cost + r.total_cost,
    }),
    { session_count: 0, total_input: 0, total_output: 0, total_cost: 0 }
  );

  const headers = ["Date", "Sessions", "Input Tok", "Output Tok", "Cost USD"];
  console.log(formatTable(headers, tableRows));
  console.log(
    `\n  ${ANSI_BOLD}TOTAL${ANSI_RESET} ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${formatNumber(totals.session_count).padStart(8)} ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${formatNumber(totals.total_input).padStart(11)} ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${formatNumber(totals.total_output).padStart(11)} ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${ANSI_GREEN}${formatCost(totals.total_cost).padStart(8)}${ANSI_RESET}`
  );
}

/**
 * Render breakdown per model. Pakai OpenCodeAdapter.fetchModelUsageSummary()
 * jika available; fallback ke OmpNativeAdapter.
 */
async function renderModelsSection(
  opencode: OpenCodeAdapter | null,
  native: OmpNativeAdapter
): Promise<void> {
  console.log(
    `\n${ANSI_BOLD}  🤖 BY MODEL — Provider/Model Breakdown${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}  ${"─".repeat(80)}${ANSI_RESET}`);

  let rows: ModelUsageSummary[];
  if (opencode) {
    rows = opencode.fetchModelUsageSummary(false);
  } else {
    const messages = await native.getMessagesSummary();
    rows = mapNativeToModels(messages);
  }

  if (rows.length === 0) {
    console.log(
      `  ${ANSI_GRAY}ℹ️  Belum ada model usage.${ANSI_RESET}`
    );
    return;
  }

  // Header: provider badge + model + sessions + tokens + cost
  const tableRows = rows.map((m) => {
    const providerBadge = formatProviderBadge(m.provider ?? "unknown");
    const modelShort = m.modelId.length > 36
      ? m.modelId.slice(0, 33) + "..."
      : m.modelId;
    return [
      providerBadge,
      modelShort,
      String(m.sessionCount),
      formatNumber(m.totalTokens),
      formatCost(m.totalCost),
    ];
  });

  const totals = sumTotals(rows);
  const headers = ["Provider", "Model", "Sessions", "Tokens Total", "Cost USD"];
  console.log(formatTable(headers, tableRows));
  console.log(
    `\n  ${ANSI_BOLD}TOTAL${ANSI_RESET} ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${formatNumber(totals.sessionCount).padStart(8)} sessions ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${formatNumber(totals.totalTokens).padStart(11)} tokens ` +
    `${ANSI_GRAY}│${ANSI_RESET} ${ANSI_GREEN}${formatCost(totals.totalCost).padStart(8)}${ANSI_RESET}`
  );
}

// ─── DB Queries (read-only via safeQuery) ────────────────────

interface DailyRow {
  day: string;
  session_count: number;
  total_cost: number;
  total_input: number;
  total_output: number;
}

/**
 * Fetch per-day breakdown via safeQuery. Wrapper di sini agar:
 *   1. View logic terisolasi dari handler
 *   2. Testable tanpa instantiate full adapter
 *   3. Tetap read-only (safeQuery enforces { readonly: true })
 *
 * Query SQL: GROUP BY date(time_created/1000, "unixepoch")
 * — SQLite function untuk konversi Unix ms → date string.
 */
function fetchDailyBreakdown(days: number): DailyRow[] {
  const cutoffTs = Date.now() - days * 24 * 60 * 60 * 1000;
  const sql = `
    SELECT
      date(time_created / 1000, 'unixepoch') AS day,
      COUNT(*) AS session_count,
      COALESCE(SUM(cost), 0) AS total_cost,
      COALESCE(SUM(tokens_input), 0) AS total_input,
      COALESCE(SUM(tokens_output), 0) AS total_output
    FROM session
    WHERE parent_id IS NULL
      AND time_created >= ?
    GROUP BY day
    ORDER BY day DESC
  `;
  return safeQuery<DailyRow>(getOpenCodeDb(), sql, [cutoffTs]);
}

// ─── Mapping helpers ─────────────────────────────────────────

/**
 * Sum totals dari ModelUsageSummary[]. Pakai untuk footer/JSON.
 */
function sumTotals(rows: ModelUsageSummary[]) {
  return rows.reduce(
    (acc, m) => ({
      totalCost: acc.totalCost + m.totalCost,
      totalTokensInput: acc.totalTokensInput + m.totalTokensInput,
      totalTokensOutput: acc.totalTokensOutput + m.totalTokensOutput,
      totalTokens: acc.totalTokens + m.totalTokens,
      sessionCount: acc.sessionCount + m.sessionCount,
    }),
    { totalCost: 0, totalTokensInput: 0, totalTokensOutput: 0, totalTokens: 0, sessionCount: 0 }
  );
}

/**
 * Sum totals dari OmpNativeMessageSummary[].
 */
function sumNativeTotals(rows: OmpNativeMessageSummary[]) {
  return rows.reduce(
    (acc, m) => ({
      totalRequests: acc.totalRequests + m.totalRequests,
      totalCost: acc.totalCost + m.totalCost,
    }),
    { totalRequests: 0, totalCost: 0 }
  );
}

/**
 * Map OmpNativeMessageSummary → ModelUsageSummary agar model
 * section punya shape seragam antara opencode & fallback.
 *
 * CATATAN: OmpNative tidak punya info variant & time window,
 * jadi kita synthesize variant=null dan pakai semua-time
 * (tidak filter ke window N hari).
 */
function mapNativeToModels(
  messages: OmpNativeMessageSummary[]
): ModelUsageSummary[] {
  return messages.map((m) => ({
    modelId: `${m.provider}/${m.model}`,
    provider: m.provider,
    variant: null,
    totalCost: m.totalCost,
    totalTokensInput: m.totalInputTokens,
    totalTokensOutput: m.totalOutputTokens,
    totalTokens: m.totalInputTokens + m.totalOutputTokens,
    sessionCount: m.totalRequests,
  }));
}

// ─── Entry point (saat dijalankan langsung via `bun run`) ────

const isMainModule = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    const selfPath = new URL(import.meta.url).pathname;
    return selfPath === arg1 || arg1.endsWith("stats.ts");
  } catch {
    return arg1.endsWith("stats.ts");
  }
})();

if (isMainModule) {
  handleStatsCommand(process.argv.slice(2))
    .then((code) => exit(code))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`💥 gn stats crash: ${msg}\n`);
      exit(1);
    });
}
