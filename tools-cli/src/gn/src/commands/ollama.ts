#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Command: `gn ollama` / `gn om`
//
// Live Ollama Cloud quota viewer. THIN WRAPPER di atas
// src/ollama-me.ts (architect section 6.2):
//
//   - TIDAK ADA logika fetch di sini. Semua delegasi ke
//     fetchOllamaAccountsMeta() di ollama-me.ts.
//   - ollama-me.ts di-preserve 100% (architect invariant).
//   - Command layer fokus pada: parse args, render output,
//     bypass cache (--refresh), JSON mode (--json).
//
// FLAG:
//   --refresh    Hapus cache 15-menit, paksa fetch ulang
//   --json       Output JSON mentah (untuk scripting)
//   -h, --help   Level-2 help
// ─────────────────────────────────────────────────────────────

import { stderr, exit } from "node:process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import {
  printGnHeader,
  formatProviderBadge,
  formatProgressBar,
  formatStatusBadge,
  formatResetCountdown,
  formatDate,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
} from "../utils/formatter";
import {
  fetchOllamaAccountsMeta,
  type OllamaAccountMeta,
} from "../ollama-me";

// ─── Constants (mirror dari ollama-me.ts — tidak import
//      internal constants karena module itu preserved) ──────

/**
 * Path cache 15-menit yang dipakai ollama-me.ts.
 * HARUS sama dengan CACHE_FILE di ollama-me.ts line 31.
 * Kalau ollama-me.ts refactor path-nya, update juga di sini.
 */
const CACHE_FILE_PATH = join(
  homedir(),
  ".cache", "goblin-nexus", "ollama-me-cache.json"
);

// ─── CLI Args ────────────────────────────────────────────────

interface OllamaArgs {
  refresh: boolean;
  json: boolean;
  help: boolean;
}

function parseOllamaArgs(argv: string[]): OllamaArgs {
  const args: OllamaArgs = { refresh: false, json: false, help: false };
  for (const a of argv) {
    if (a === "--refresh") args.refresh = true;
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

// ─── Help (Level 2) ──────────────────────────────────────────

function printOllamaHelp(): void {
  const lines = [
    "",
    "GN OLLAMA — Live Cloud Quota Viewer",
    "════════════════════════════════════════════════════════════",
    "",
    "DESKRIPSI:",
    "  Tampilkan live quota akun Ollama Cloud kamu. Command ini",
    "  fetch metadata langsung dari ollama.com/api/me + scrape",
    "  ollama.com/settings (jika cookie tersedia). Hasil di-cache",
    "  15 menit di ~/.cache/goblin-nexus/ollama-me-cache.json.",
    "",
    "PENGGUNAAN:",
    "  gn ollama [flags]",
    "  gn om     [flags]",
    "",
    "FLAGS:",
    "  --refresh   Hapus cache 15-menit, paksa fetch ulang dari",
    "              ollama.com (berguna kalau baru topup / reset)",
    "  --json      Output JSON mentah (untuk scripting/pipe)",
    "  -h, --help  Tampilkan help ini",
    "",
    "SUMBER DATA:",
    "  - ~/.omp/agent/agent.db                (auth_credentials, single source of truth)",
    "  - POST https://ollama.com/api/me       (email + plan)",
    "  - GET  https://ollama.com/settings     (session/weekly %, jika cookie tersedia)",
    "",
    "VISUAL INDICATORS:",
    `  ${formatStatusBadge("ok")}        Akun aktif & normal`,
    `  ${formatStatusBadge("warn")}      Session/weekly mendekati limit`,
    `  ${formatStatusBadge("error")}    Suspended / fetch gagal`,
    "",
    "CONTOH:",
    "  gn ollama                   # Tampilkan semua akun",
    "  gn om --refresh             # Bypass cache, fetch ulang",
    "  gn ollama --json | jq .     # Pipe ke jq untuk filter",
    "",
    "OUTPUT LAYOUT:",
    "  ┌─ Banner ASCII",
    "  ├─ #1  goblin@mail.com  [Pro]",
    "  │     Session  [████████░░░░░░░] 62%  resets: Aug 5 09:00",
    "  │     Weekly   [████░░░░░░░░░░░░] 27%",
    "  └─ #2  goblin2@mail.com [Free] 🔴 ERROR suspended",
    "",
    "TROUBLESHOOTING:",
    "  - Kalau tidak ada akun muncul, cek tabel auth_credentials di",
    "    ~/.omp/agent/agent.db untuk provider='ollama-cloud'.",
    "    SQL: SELECT id, data FROM auth_credentials WHERE provider='ollama-cloud';",
    "  - Kalau 'suspended' muncul, akun di-flag oleh Ollama —",
    "    cek https://ollama.com/settings untuk detail.",
    "",
  ];
  console.log(lines.join("\n"));
}

// ─── Handler ─────────────────────────────────────────────────

/**
 * Handler utama untuk command `gn ollama`.
 *
 * @param argv  Argumen setelah subcommand
 * @returns Exit code: 0 sukses, 1 error
 */
export async function handleOllamaCommand(argv: string[]): Promise<number> {
  const args = parseOllamaArgs(argv);

  if (args.help) {
    printOllamaHelp();
    return 0;
  }

  // ── Bypass cache kalau --refresh ─────────────────────────
  if (args.refresh) {
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        unlinkSync(CACHE_FILE_PATH);
        if (!args.json) {
          console.log(`${ANSI_GRAY}🗑  Cache dihapus: ${CACHE_FILE_PATH}${ANSI_RESET}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`⚠️  Gagal hapus cache: ${msg}\n`);
      // Lanjut — fetch tetap jalan walaupun cache gagal dihapus
    }
  }

  // ── Fetch accounts ───────────────────────────────────────
  let accounts: OllamaAccountMeta[];
  try {
    accounts = await fetchOllamaAccountsMeta();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`❌ Fetch Ollama accounts gagal: ${msg}\n`);
    return 1;
  }

  // ── JSON mode ────────────────────────────────────────────
  if (args.json) {
    console.log(JSON.stringify(accounts, null, 2));
    return 0;
  }

  // ── Render mode ──────────────────────────────────────────
  printGnHeader("OLLAMA CLOUD QUOTA");

  if (accounts.length === 0) {
    console.log(
      `\n${ANSI_GRAY}ℹ️  Tidak ada akun Ollama Cloud terdeteksi.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Pastikan ada row di auth_credentials dengan provider='ollama-cloud'.${ANSI_RESET}`
    );
    console.log(
      `${ANSI_GRAY}   Jalankan 'gn doctor' untuk diagnostik lengkap.${ANSI_RESET}\n`
    );
    return 0;
  }

  // Header ringkas
  console.log(
    `\n${ANSI_BOLD}  #     Email                          Plan      Session Bar              Weekly Bar              Reset${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}  ${"─".repeat(110)}${ANSI_RESET}`);

  for (let i = 0; i < accounts.length; i++) {
    renderOllamaAccount(i + 1, accounts[i]);
  }

  // Footer
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  console.log(
    `\n${ANSI_GRAY}  ─${ANSI_RESET} ${ANSI_CYAN}⏱  Fetched: ${hh}:${mm}:${ss}${ANSI_RESET}` +
    `${ANSI_GRAY} (cache TTL 15m · ${accounts.length} akun)${ANSI_RESET}\n`
  );

  return 0;
}

// ─── Render helpers ──────────────────────────────────────────

/**
 * Render satu akun Ollama: header + session bar + weekly bar + reset.
 */
function renderOllamaAccount(idx: number, acc: OllamaAccountMeta): void {
  // Session & Weekly bars (pct/100 → fraction)
  const sessBar = formatProgressBar(acc.sessionUsagePct / 100, 16);
  const weekBar = formatProgressBar(acc.weeklyUsagePct / 100, 16);

  // Plan badge
  const planBadge = acc.plan?.toLowerCase() === "pro"
    ? `${ANSI_CYAN}[Pro]${ANSI_RESET}`
    : `${ANSI_GRAY}[${acc.plan || "free"}]${ANSI_RESET}`;

  // Suspended warning
  const suspendedTag = acc.suspended
    ? `  ${formatStatusBadge("error")} suspended`
    : "";

  // Status badge untuk overall account health
  const overallStatus = computeAccountStatus(acc);

  // Reset countdown — sessionResetsAt adalah ISO string
  let resetStr = `${ANSI_GRAY}-${ANSI_RESET}`;
  if (acc.sessionResetsAt) {
    const ts = Date.parse(acc.sessionResetsAt);
    if (!isNaN(ts)) {
      // Tampilkan absolute date + countdown
      const dateStr = formatDate(ts);
      const countdown = formatResetCountdown(ts);
      resetStr = `${ANSI_CYAN}${dateStr}${ANSI_RESET} ${ANSI_GRAY}(${countdown})${ANSI_RESET}`;
    }
  }

  // Compose email display
  const email = acc.email.length > 28
    ? acc.email.slice(0, 25) + "..."
    : acc.email.padEnd(28);

  // Header line
  console.log(
    `\n  ${ANSI_GRAY}#${idx}${ANSI_RESET}  ${email}  ${planBadge}  ${overallStatus}${suspendedTag}`
  );
  // Bars line
  console.log(
    `        ${ANSI_GRAY}session${ANSI_RESET} ${sessBar}    ${ANSI_GRAY}weekly ${ANSI_RESET}${weekBar}    ${resetStr}`
  );
}

/**
 * Tentukan status keseluruhan akun berdasarkan pct dan flag suspended.
 */
function computeAccountStatus(acc: OllamaAccountMeta): string {
  if (acc.suspended) return formatStatusBadge("error");
  const max = Math.max(acc.sessionUsagePct, acc.weeklyUsagePct);
  if (max >= 90) return formatStatusBadge("critical");
  if (max >= 70) return formatStatusBadge("warn");
  return formatStatusBadge("ok");
}

// ─── Entry point (saat dijalankan langsung via `bun run`) ────

const isMainModule = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    const selfPath = new URL(import.meta.url).pathname;
    return selfPath === arg1 || arg1.endsWith("ollama.ts");
  } catch {
    return arg1.endsWith("ollama.ts");
  }
})();

if (isMainModule) {
  handleOllamaCommand(process.argv.slice(2))
    .then((code) => exit(code))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`💥 gn ollama crash: ${msg}\n`);
      exit(1);
    });
}
