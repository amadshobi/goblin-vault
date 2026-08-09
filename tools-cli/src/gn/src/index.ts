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
import { handleConfigCommand } from "./commands/config";
import { handlePingCommand } from "./commands/ping";
import { handleBenchCommand } from "./commands/bench";
import {
  handleDoctorCommand,
  handleRestartCommand,
} from "./commands/doctor";

/** Versi gn standalone v2.0.0 (Control Plane & Telemetry Core). */
export const GN_VERSION = "2.0.0";

/**
 * Peta subcommand → handler.
 */
const COMMANDS: Record<string, (argv: string[]) => Promise<number>> = {
  // Quota & telemetry cost
  usage: handleUsageCommand,
  u: handleUsageCommand,

  // Configuration management (Leburan OCM)
  config: handleConfigCommand,
  c: handleConfigCommand,

  // Connectivity & benchmarking
  ping: handlePingCommand,
  p: handlePingCommand,
  bench: handleBenchCommand,
  b: handleBenchCommand,

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
  console.log("  $ gn <command> --help                  \x1b[1;33m󰋽 Panduan mendalam per-command!\x1b[0m");
  console.log("");
  console.log("TELEMETRY & QUOTA TRACKING");
  console.log("  usage, u    [flags]       \x1b[1;36m󰓅\x1b[0m Quota usage (--tokens, --sessions, --json)");
  console.log("");
  console.log("CONFIGURATION MANAGEMENT");
  console.log("  config, c   get/set [path]\x1b[1;36m󰒓\x1b[0m OpenCode & Agent config manager");
  console.log("");
  console.log("CONNECTIVITY & BENCHMARKING");
  console.log("  ping, p                   \x1b[1;36m󱈸\x1b[0m Cek konektivitas OMP, Ollama, & DB");
  console.log("  bench, b    [-n runs]     \x1b[1;36m󱎫\x1b[0m Benchmark latency endpoint OMP Gateway");
  console.log("");
  console.log("SERVICE CONTROL & DIAGNOSTICS");
  console.log("  doctor, doc [--check/-c]  \x1b[1;36m󰋼\x1b[0m Full health diagnostic & config syntax check");
  console.log("  restart, r                \x1b[1;36m󰑐\x1b[0m Restart systemd user services");
  console.log("");
  console.log("META");
  console.log("  help, h                  \x1b[1;36m󰈙\x1b[0m Tampilkan panduan ini");
  console.log("  version, v               \x1b[1;36m󰓹\x1b[0m Tampilkan versi");
  console.log("");
  console.log("EXAMPLES");
  console.log("  $ gn usage                 \x1b[2m# Quota usage live\x1b[0m");
  console.log("  $ gn u --tokens --days 7   \x1b[2m# Token burn 7 hari terakhir\x1b[0m");
  console.log("  $ gn u --sessions -w       \x1b[2m# Session analytics mingguan\x1b[0m");
  console.log("  $ gn c get agent           \x1b[2m# Cek list agent opencode\x1b[0m");
  console.log("  $ gn doctor --check        \x1b[2m# Audit health & syntax jsonc\x1b[0m");
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
  console.error("\x1b[1;31m󰅚 [Goblin Roast Error] Subcommand tidak dikenal: \x1b[1;37m" + cmd + "\x1b[0m");
  console.error("\x1b[1;33m󰋽 Hint: Jalankan \x1b[1;37mgn help\x1b[1;33m untuk melihat daftar command yang tersedia.\x1b[0m");
  console.error("");
}

function reportDeprecated(cmd: string, msg: string): void {
  console.error("");
  console.error("\x1b[1;33m󰀦  " + msg + "\x1b[0m");
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
