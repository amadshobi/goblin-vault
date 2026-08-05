/**
 * ─────────────────────────────────────────────────────────────
 * Goblin Nexus — Master CLI Entry Point (gn v2)
 * ─────────────────────────────────────────────────────────────
 *
 * Router TypeScript untuk seluruh subcommand `gn`.
 * Shell launcher `gn.sh` meneruskan semua argv ke file ini;
 * kita dispatch ke handler sesuai subcommand pertama.
 *
 * Aturan desain:
 *   - Setiap handler menerima argv SETELAH subcommand (bukan termasuk).
 *     Mis. `gn usage --json` → handleUsageCommand(["--json"]).
 *   - Help level-1 (banner + daftar command) ada di sini.
 *   - Help level-2 (panduan mendalam) ada di masing-masing handler.
 *   - Exit code: 0 sukses, 1 kesalahan umum, 2 deprecation.
 */

import { printGnHeader } from "./utils/formatter";
import { handleUsageCommand } from "./commands/usage";
import { handleOllamaCommand } from "./commands/ollama";
import { handleStatsCommand } from "./commands/stats";
import { handleSessionsCommand } from "./commands/sessions";
import {
  handleDoctorCommand,
  handleRestartCommand,
} from "./commands/doctor";

/** Versi gn standalone v1.0.0 (TypeScript Engine Port). */
export const GN_VERSION = "1.0.0";

/**
 * Peta subcommand → handler.
 * Alias singkat (`u`, `o`, `s`, `ses`, `doc`, `r`) mengikuti pola lama `gn.sh`.
 */
const COMMANDS: Record<string, (argv: string[]) => Promise<number>> = {
  // Quota & cost
  usage: handleUsageCommand,
  u: handleUsageCommand,

  // Ollama multi-account
  ollama: handleOllamaCommand,
  o: handleOllamaCommand,

  // Activity & analytics
  stats: handleStatsCommand,
  s: handleStatsCommand,
  sessions: handleSessionsCommand,
  ses: handleSessionsCommand,

  // Service control
  doctor: handleDoctorCommand,
  doc: handleDoctorCommand,
  restart: handleRestartCommand,
  r: handleRestartCommand,
};

/**
 * Subcommand lama yang sudah didepresiasi.
 * Pesan akan ditampilkan + exit code 2 (conventional untuk deprecated command).
 * Logika ini ada di sini (bukan di gn.sh) supaya `bin/gn` (yang langsung
 * exec ke router ini) tetap bisa menampilkan deprecation warning yang benar.
 */
const DEPRECATED_COMMANDS: Record<string, string> = {
  ping:
    "Command 'gn ping' telah didepresiasi. Gunakan REST API OMP (GET /healthz) atau 'omp ping' untuk health-check.",
  p:
    "Command 'gn ping' telah didepresiasi. Gunakan REST API OMP (GET /healthz) atau 'omp ping' untuk health-check.",
  bench:
    "Command 'gn bench' telah didepresiasi. Gunakan REST API OMP (POST /v1/chat/completions) atau 'ocm bench' untuk benchmark model.",
  b:
    "Command 'gn bench' telah didepresiasi. Gunakan REST API OMP (POST /v1/chat/completions) atau 'ocm bench' untuk benchmark model.",
  quarantine:
    "Command 'gn quarantine' telah didepresiasi. Gunakan REST API OMP Auth-Broker (POST /v1/credential/:id/disable).",
  q:
    "Command 'gn quarantine' telah didepresiasi. Gunakan REST API OMP Auth-Broker (POST /v1/credential/:id/disable).",
  export:
    "Command 'gn export' telah didepresiasi. Gunakan REST API OMP Auth-Broker (GET /v1/snapshot).",
  e:
    "Command 'gn export' telah didepresiasi. Gunakan REST API OMP Auth-Broker (GET /v1/snapshot).",
};

/** Cetak banner ringkas untuk header bantuan/error. */
function printBanner(): void {
  printGnHeader(`v${GN_VERSION} · Powered by OMP Engine`);
}

/** Cetak bantuan level-1 (banner + daftar command). */
function showHelp(): void {
  printBanner();
  console.log("USAGE");
  console.log("  $ gn <command> [args]");
  console.log("  $ gn <command> --help                  \x1b[1;33m💡 Panduan mendalam per-command!\x1b[0m");
  console.log("");
  console.log("QUOTA & COST TRACKING");
  console.log("  usage, u    [provider]    \x1b[1;36m📈\x1b[0m Dashboard kuota live + token burn & cost tracker");
  console.log("  ollama, o   [--refresh]   \x1b[1;36m🦙\x1b[0m Status akun Ollama multi-account");
  console.log("");
  console.log("ACTIVITY & ANALYTICS");
  console.log("  stats, s    [--today|--daily|--models]   \x1b[1;36m📊\x1b[0m Statistik session, cost, model usage");
  console.log("  sessions, ses [-n=N] [prefix]            \x1b[1;36m📚\x1b[0m Riwayat session opencode");
  console.log("");
  console.log("SERVICE CONTROL");
  console.log("  doctor, doc [--short]    \x1b[1;36m🩺\x1b[0m Full-chain system health diagnostic");
  console.log("  restart, r               \x1b[1;36m🔄\x1b[0m Restart systemd user services (omp-broker, omp-gateway)");
  console.log("");
  console.log("META");
  console.log("  help, h                  \x1b[1;36m📜\x1b[0m Tampilkan panduan ini");
  console.log("  version, v               \x1b[1;36m🔖\x1b[0m Tampilkan versi");
  console.log("");
  console.log("EXAMPLES");
  console.log("  $ gn usage                 \x1b[2m# Dashboard kuota + token burn\x1b[0m");
  console.log("  $ gn usage anthropic --json");
  console.log("  $ gn stats --today         \x1b[2m# Statistik hari ini\x1b[0m");
  console.log("  $ gn sessions -s=5         \x1b[2m# 5 session terakhir\x1b[0m");
  console.log("  $ gn doctor --short        \x1b[2m# Diagnostic ringkas\x1b[0m");
  console.log("  $ gn ollama --refresh      \x1b[2m# Refresh cache Ollama\x1b[0m");
  console.log("");
}

/** Cetak versi singkat. */
function showVersion(): void {
  console.log(`gn v${GN_VERSION}`);
}

/**
 * Cetak pesan error ramah + hint perbaikan (Goblin Roast pattern).
 */
function reportUnknown(cmd: string): void {
  console.error("");
  console.error("\x1b[1;31m🔥 [Goblin Roast Error] Subcommand tidak dikenal: \x1b[1;37m" + cmd + "\x1b[0m");
  console.error("\x1b[1;33m💡 Hint: Jalankan \x1b[1;37mgn help\x1b[1;33m untuk melihat daftar command yang tersedia.\x1b[0m");
  console.error("");
}

/**
 * Cetak warning depresiasi untuk command yang sudah dihapus/redirected.
 */
function reportDeprecated(cmd: string, msg: string): void {
  console.error("");
  console.error("\x1b[1;33m⚠️  " + msg + "\x1b[0m");
  console.error("");
}

/**
 * Entry point utama. Dipanggil oleh `bun src/index.ts ...`
 * atau dari pengujian.
 */
export async function main(argv: string[]): Promise<number> {
  const cmd = argv[0];

  // Fallback help & version (Level 1)
  if (!cmd || cmd === "help" || cmd === "h" || cmd === "--help" || cmd === "-h") {
    showHelp();
    return 0;
  }
  if (cmd === "version" || cmd === "v" || cmd === "--version" || cmd === "-V") {
    showVersion();
    return 0;
  }

  // Deprecation warnings — exit code 2 (konvensi untuk deprecated command).
  const deprecationMsg = DEPRECATED_COMMANDS[cmd];
  if (deprecationMsg) {
    reportDeprecated(cmd, deprecationMsg);
    return 2;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    reportUnknown(cmd);
    return 1;
  }

  try {
    return await handler(argv.slice(1));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("");
    console.error(`\x1b[1;31m🔥 [Goblin Roast Error] ${cmd} crash:\x1b[0m`);
    console.error(`\x1b[0m   ${msg}\x1b[0m`);
    console.error("");
    return 1;
  }
}

/**
 * Direct-invocation guard.
 *   $ bun src/index.ts usage --json
 * Dipasang di akhir file agar test/kode lain bisa import `main()` tanpa
 * langsung mengeksekusi side-effect.
 */
if (import.meta.main) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}
