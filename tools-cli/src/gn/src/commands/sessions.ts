#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Command: `gn sessions` / `gn ses`
//
// Detail lengkap per-sesi OpenCode dengan format vertikal identik
// dengan token-stats.ts + kalkulasi Est. Cost via price.json.
// ─────────────────────────────────────────────────────────────

import { stderr, exit } from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import type { SessionDetail } from "../types";
import { OpenCodeAdapter } from "../adapters/opencode";
import {
  printGnHeader,
  formatNumber,
  formatCost,
  formatDate,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_GREEN,
  ANSI_YELLOW,
} from "../utils/formatter";

// ─── Pricing Engine (tools-cli/src/gn/config/price.json) ─────

type PriceSpec = { input: number; output: number; cache?: number };
let PRICING: Record<string, PriceSpec> = {};

// Prioritas 1: `tools-cli/src/gn/config/price.json` di dalam monorepo vault
// Prioritas 2: Fallback ke `~/.opencode/scripts/price.json` jika file monorepo tidak ada
const monorepoPricePath = join(__dirname, "..", "..", "config", "price.json");
const fallbackPricePath = join(homedir(), ".opencode", "scripts", "price.json");

if (existsSync(monorepoPricePath)) {
  try {
    PRICING = JSON.parse(readFileSync(monorepoPricePath, "utf-8"));
  } catch {}
} else if (existsSync(fallbackPricePath)) {
  try {
    PRICING = JSON.parse(readFileSync(fallbackPricePath, "utf-8"));
  } catch {}
}

function calculateEstCost(modelId: string, inputTokens: number, outputTokens: number, cacheReadTokens: number): number {
  // Extract model name (misal "google-antigravity/gemini-3.6-flash" -> "gemini-3.6-flash")
  const parts = modelId.split("/");
  const cleanModel = parts[parts.length - 1].split(":")[0];
  const price = PRICING[cleanModel] || PRICING[modelId];

  if (!price) return 0;
  const inCost = (inputTokens / 1_000_000) * (price.input || 0);
  const outCost = (outputTokens / 1_000_000) * (price.output || 0);
  const cacheCost = (cacheReadTokens / 1_000_000) * (price.cache || 0);
  return inCost + outCost + cacheCost;
}

// ─── CLI Args ────────────────────────────────────────────────

interface SessionsArgs {
  limit: number;
  prefix: string | null;
  help: boolean;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parseSessionsArgs(argv: string[]): SessionsArgs {
  const args: SessionsArgs = {
    limit: DEFAULT_LIMIT,
    prefix: null,
    help: false,
  };
  for (const a of argv) {
    if (a === "-h" || a === "--help") args.help = true;
    else if (a.startsWith("-s=")) {
      const n = parseInt(a.slice(3), 10);
      if (Number.isFinite(n) && n > 0) {
        args.limit = Math.min(n, MAX_LIMIT);
      }
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice(8), 10);
      if (Number.isFinite(n) && n > 0) {
        args.limit = Math.min(n, MAX_LIMIT);
      }
    } else if (!a.startsWith("-")) {
      args.prefix = args.prefix ?? a;
    }
  }
  return args;
}

// ─── Help (Level 2) ──────────────────────────────────────────

function printSessionsHelp(): void {
  const lines = [
    "",
    "GN SESSIONS — OpenCode Live Session Detail",
    "═════════════════════════════════════════════════════════════════════════════════════════════════════════",
    "",
    "DESKRIPSI:",
    "  Tampilkan detail lengkap N sesi terbaru OpenCode dengan format vertikal presisi",
    "  lengkap dengan rincian token, estimasi cost USD, tool usage, dan file ter-modify.",
    "",
    "PENGGUNAAN:",
    "  gn sessions [flags] [session-id-prefix]",
    "  gn ses     [flags] [session-id-prefix]",
    "",
    "FLAGS:",
    "  -s=N             Limit sesi (default: 10, max: 50)",
    "      --limit=N    Alias untuk -s=N",
    "  [session-id-prefix]  Filter sesi by ID prefix",
    "  -h, --help       Tampilkan help ini",
    "",
    "CONTOH:",
    "  gn sessions                # 10 sesi terbaru",
    "  gn sessions -s=5           # 5 sesi terbaru",
    "  gn ses --limit=20          # 20 sesi (max: 50)",
    "  gn sessions ses_abc        # Filter ID prefix 'ses_abc'",
    "",
  ];
  console.log(lines.join("\n"));
}

// ─── Handler ─────────────────────────────────────────────────

export async function handleSessionsCommand(argv: string[]): Promise<number> {
  const args = parseSessionsArgs(argv);

  if (args.help) {
    printSessionsHelp();
    return 0;
  }

  const adapter = new OpenCodeAdapter();

  if (!adapter.isAvailable()) {
    printGnHeader("OPENCODE SESSIONS");
    console.log(`\n${ANSI_GRAY}⚠️  opencode.db tidak ditemukan.${ANSI_RESET}`);
    return 1;
  }

  let sessions: SessionDetail[];
  try {
    sessions = adapter.fetchRecentSessions(args.limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`❌ Fetch sessions gagal: ${msg}\n`);
    return 1;
  }

  const filtered = args.prefix
    ? sessions.filter((s) => s.id.startsWith(args.prefix!))
    : sessions;

  if (filtered.length === 0) {
    printGnHeader("OPENCODE SESSIONS");
    console.log(`\n${ANSI_GRAY}ℹ️  Tidak ada sesi ditemukan${args.prefix ? ` dengan prefix "${args.prefix}"` : ""}.${ANSI_RESET}\n`);
    return 0;
  }

  printGnHeader("OPENCODE SESSIONS");

  const SOLID_LINE = "─────────────────────────────────────────────────────────────────────────────────────────────────────────";

  console.log(`\n${ANSI_BOLD}RINCIAN PENGGUNAAN TOKEN PER SESI (${filtered.length} SESI DITAMPILKAN)${ANSI_RESET}`);
  console.log(SOLID_LINE);

  let grandTotalCost = 0;

  filtered.forEach((s, idx) => {
    const inp = s.tokensInput || 0;
    const out = s.tokensOutput || 0;
    const reas = s.tokensReasoning || 0;
    const cRead = s.tokensCacheRead || 0;

    const cost = calculateEstCost(s.modelId, inp, out, cRead);
    grandTotalCost += cost;

    const dateStr = formatDate(s.timeCreated);

    // Format tool usage
    const toolSummaryStr =
      s.toolCount && Object.keys(s.toolCount).length > 0
        ? Object.entries(s.toolCount)
            .sort((a, b) => b[1] - a[1])
            .map(([t, c]) => `${t} (${c}x)`)
            .join(", ")
        : "-";

    console.log(`[${idx + 1}] Session ID : ${s.id}`);
    console.log(`    Waktu      : ${dateStr}`);
    console.log(`    Title      : ${s.title || "-"}`);
    console.log(`    Directory  : ${s.directory || "-"}`);
    console.log(`    Model      : ${s.modelId}`);
    console.log(`    Tokens     : Input: ${formatNumber(inp)} | Output: ${formatNumber(out)} | Reasoning: ${formatNumber(reas)}`);
    console.log(`    Cache Read : ${formatNumber(cRead)} Tokens`);
    console.log(`    Est. Cost  : ${formatCost(cost)} USD`);
    console.log(`    Tool Usage : ${toolSummaryStr}`);

    if (s.modifiedFiles && s.modifiedFiles.length > 0) {
      console.log(`    Modified   :`);
      s.modifiedFiles.forEach((f) => console.log(`       - ${f}`));
    }

    if (idx < filtered.length - 1) {
      console.log(SOLID_LINE);
    }
  });

  console.log(SOLID_LINE);
  console.log(`${ANSI_BOLD}TOTAL SESI DITAMPILKAN : ${filtered.length} Sesi${ANSI_RESET}`);
  console.log(`${ANSI_BOLD}TOTAL ESTIMASI COST    : ${formatCost(grandTotalCost)} USD${ANSI_RESET}`);
  console.log(SOLID_LINE + "\n");

  return 0;
}

// ─── Entry point ─────────────────────────────────────────────

const isMainModule = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    const selfPath = new URL(import.meta.url).pathname;
    return selfPath === arg1 || arg1.endsWith("sessions.ts");
  } catch {
    return arg1.endsWith("sessions.ts");
  }
})();

if (isMainModule) {
  handleSessionsCommand(process.argv.slice(2))
    .then((code) => exit(code))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`💥 gn sessions crash: ${msg}\n`);
      exit(1);
    });
}
