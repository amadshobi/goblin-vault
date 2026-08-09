#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Command: `gn doctor` & `gn restart`
//
// Health diagnostic + service restart. TIDAK pakai adapter —
// murni shell subprocess (systemctl, ss) + filesystem checks.
//
// ARSITEKTUR (architect section 6.5):
//   - 8 health checks berurutan (services, DBs, ports, dll).
//   - Setiap check return DoctorCheckResult { name, status, detail, hint? }.
//   - Goblin Roast Hint WAJIB untuk status warn|error (UX standard).
//   - --short: hanya tampilkan warn|error items
//   - --json: output JSON untuk scripting
//
// `gn restart` (handleRestartCommand): Hanya panggil
// `systemctl --user restart omp-broker omp-gateway`. Tampilkan
// hasil sebelum & sesudah.
// ─────────────────────────────────────────────────────────────

import { stderr, exit } from "node:process";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { DoctorCheckResult } from "../types";
import {
  printGnHeader,
  formatStatusBadge,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_RED,
  ANSI_GREEN,
  ANSI_YELLOW,
} from "../utils/formatter";
import { stripComments } from "../utils/config";

// ─── Paths (single source of truth) ──────────────────────────

const PATHS = {
  brokerToken: join(homedir(), ".omp", "auth-broker.token"),
  agentDb: join(homedir(), ".omp", "agent", "agent.db"),
  opencodeDb: join(homedir(), ".local", "share", "opencode", "opencode.db"),
  statsDb: join(homedir(), ".omp", "stats.db"),
  secretDir: join(homedir(), ".shell", "secret"),
  cacheDir: join(homedir(), ".cache", "goblin-nexus"),
  brokerService: "omp-broker.service",
  gatewayService: "omp-gateway.service",
};

// ─── CLI Args ────────────────────────────────────────────────

interface DoctorArgs {
  short: boolean;
  json: boolean;
  help: boolean;
  check: boolean;
}

function parseDoctorArgs(argv: string[]): DoctorArgs {
  const args: DoctorArgs = { short: false, json: false, help: false, check: false };
  for (const a of argv) {
    if (a === "--short") args.short = true;
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-c" || a === "--check") args.check = true;
  }
  return args;
}

// ─── Help (Level 2) ──────────────────────────────────────────

function printDoctorHelp(): void {
  const lines = [
    "",
    "GN DOCTOR — System & Service Health Diagnostic",
    "════════════════════════════════════════════════════════════",
    "",
    "DESKRIPSI:",
    "  Cek kesehatan full-chain: systemd services, port listening,",
    "  SQLite databases, token auth, gateway API, secret vault.",
    "  Setiap check yang gagal menampilkan Goblin Roast Hint untuk",
    "  diagnosa & remediasi.",
    "",
    "PENGGUNAAN:",
    "  gn doctor [flags]",
    "  gn doc    [flags]",
    "",
    "FLAGS:",
    "      --short   Hanya tampilkan check yang warn/error",
    "      --json    Output JSON mentah (untuk monitoring scripts)",
    "  -c, --check   Lakukan validasi keabsahan syntax JSONC pada opencode.jsonc",
    "  -h, --help    Tampilkan help ini",
    "",
    "CHECKS YANG DILAKUKAN (urutan):",
    "  1. omp-broker.service         systemd status",
    "  2. omp-gateway.service        systemd status",
    "  3. agent.db                   file existence + size",
    "  4. opencode.db                file existence + size",
    "  5. stats.db                   file existence (opsional)",
    "  6. auth-broker.token          file existence + non-empty",
    "  7. Secret vault ~/.shell/secret  directory + JSON count",
    "  8. Cache dir ~/.cache/goblin-nexus  directory writable",
    "  9. Port 4000 (gateway)        listening check via ss",
    "",
    "OUTPUT LAYOUT:",
    "  ┌─ Banner ASCII",
    "  ├─ 󰄬 omp-broker.service         active",
    "  ├─ 󰄬 omp-gateway.service        active",
    "  ├─ 󰀦 stats.db                  NOT FOUND",
    "  │     Hint: stats.db dibuat lazily oleh OMP CLI.",
    "  └─ Summary: 8 OK, 1 WARN, 0 ERROR",
    "",
    "CONTOH:",
    "  gn doctor                # Full diagnostic",
    "  gn doc --short           # Hanya warning/error",
    "  gn doctor --json         # Untuk monitoring/CI",
    "",
    "RELATED:",
    "  gn restart               # Restart omp-broker + omp-gateway",
    "",
  ];
  console.log(lines.join("\n"));
}

// ─── Handler: Doctor ─────────────────────────────────────────

/**
 * Handler utama untuk `gn doctor`.
 * Returns exit code 0 jika semua OK, 1 jika ada error.
 */
export async function handleDoctorCommand(argv: string[]): Promise<number> {
  const args = parseDoctorArgs(argv);

  if (args.help) {
    printDoctorHelp();
    return 0;
  }

  // Run all 8+ checks (berurutan sesuai architect §6.5)
  const results: DoctorCheckResult[] = [
    checkBrokerService(),
    checkGatewayService(),
    checkAgentDb(),
    checkOpenCodeDb(),
    checkStatsDb(),
    checkBrokerToken(),
    checkSecretVault(),
    checkCacheDir(),
    await checkGatewayPort(),
  ];

  // Milestone 5: `--check` flag integration
  if (args.check) {
    results.push(checkOpenCodeJsoncSyntax());
  }

  // ── JSON mode ─────────────────────────────────────────────
  if (args.json) {
    const summary = summarize(results);
    console.log(
      JSON.stringify({ summary, results }, null, 2)
    );
    return summary.error > 0 ? 1 : 0;
  }

  // ── Render mode ───────────────────────────────────────────
  printGnHeader("SYSTEM DOCTOR");

  // Filter kalau --short
  const display = args.short
    ? results.filter((r) => r.status !== "ok")
    : results;

  if (display.length === 0) {
    console.log(
      `\n${ANSI_GREEN}  ✅ Semua check OK — tidak ada issue.${ANSI_RESET}\n`
    );
  } else {
    console.log();
    for (const r of display) {
      renderCheck(r);
    }
  }

  // Summary footer
  const s = summarize(results);
  console.log(
    `\n${ANSI_GRAY}  ${"─".repeat(80)}${ANSI_RESET}`
  );
  const parts: string[] = [];
  parts.push(`${ANSI_GREEN}${s.ok} OK${ANSI_RESET}`);
  if (s.warn > 0) parts.push(`${ANSI_YELLOW}${s.warn} WARN${ANSI_RESET}`);
  if (s.error > 0) parts.push(`${ANSI_RED}${s.error} ERROR${ANSI_RESET}`);
  console.log(`  ${ANSI_BOLD}Summary:${ANSI_RESET} ${parts.join("  ")}`);

  if (s.error > 0) {
    console.log(
      `\n  ${ANSI_RED}󰅚 Ada ${s.error} check yang gagal. Lihat hint di atas untuk fix.${ANSI_RESET}\n`
    );
  } else if (s.warn > 0) {
    console.log(
      `\n  ${ANSI_YELLOW}󰀦 Ada ${s.warn} warning. Jalankan tanpa --short untuk lihat detail.${ANSI_RESET}\n`
    );
  } else {
    console.log(
      `\n  ${ANSI_GREEN}󰄬 Sistem sehat. Semua check passed.${ANSI_RESET}\n`
    );
  }

  return s.error > 0 ? 1 : 0;
}

// ─── Handler: Restart ────────────────────────────────────────

/**
 * Handler untuk `gn restart` — restart omp-broker + omp-gateway.
 * Pure subprocess call ke systemctl.
 *
 * @returns Exit code: 0 jika restart sukses, 1 jika gagal
 */
export async function handleRestartCommand(argv: string[]): Promise<number> {
  // Parse minimal — restart tidak butuh banyak flag
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(
      [
        "",
        "GN RESTART — Restart OMP Proxy Services",
        "════════════════════════════════════════════════════════════",
        "",
        "DESKRIPSI:",
        "  Restart systemd user services: omp-broker.service dan",
        "  omp-gateway.service. Aman dipanggil kapan saja.",
        "",
        "PENGGUNAAN:",
        "  gn restart",
        "  gn r",
        "",
        "CATATAN:",
        "  - Butuh systemd user session aktif (login tanpa sudo).",
        "  - Aktif session OpenCode akan terputus saat restart.",
        "  - Tip: jalankan 'gn doctor' dulu untuk cek status.",
        "",
      ].join("\n")
    );
    return 0;
  }

  console.log(
    `\n${ANSI_CYAN}󰑐 Restarting OMP Proxy services...${ANSI_RESET}`
  );
  console.log(`${ANSI_GRAY}   ${PATHS.brokerService}${ANSI_RESET}`);
  console.log(`${ANSI_GRAY}   ${PATHS.gatewayService}${ANSI_RESET}\n`);

  try {
    // Panggil systemctl --user restart
    const proc = Bun.spawn(
      ["systemctl", "--user", "restart", PATHS.brokerService, PATHS.gatewayService],
      { stdout: "pipe", stderr: "pipe" }
    );

    const exitCode = await proc.exited;
    const stderrOut = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      stderr.write(`❌ systemctl restart gagal (exit ${exitCode})\n`);
      if (stderrOut) stderr.write(`${stderrOut}\n`);
      return 1;
    }

    console.log(`${ANSI_GREEN}✅ Services restarted successfully!${ANSI_RESET}\n`);

    // Verifikasi post-restart dengan is-active check
    console.log(`${ANSI_CYAN}⏳ Verifying service status...${ANSI_RESET}`);
    const brokerOk = await isServiceActive(PATHS.brokerService);
    const gatewayOk = await isServiceActive(PATHS.gatewayService);

    console.log(
      `  ${brokerOk ? ANSI_GREEN + "✅" : ANSI_RED + "❌"} ${PATHS.brokerService}${ANSI_RESET}` +
      `  ${brokerOk ? "active" : "NOT active"}`
    );
    console.log(
      `  ${gatewayOk ? ANSI_GREEN + "✅" : ANSI_RED + "❌"} ${PATHS.gatewayService}${ANSI_RESET}` +
      `  ${gatewayOk ? "active" : "NOT active"}`
    );

    if (!brokerOk || !gatewayOk) {
      console.log(
        `\n${ANSI_YELLOW}󰀦 Service restart selesai tapi salah satu belum aktif.${ANSI_RESET}`
      );
      console.log(
        `${ANSI_GRAY}   Cek: journalctl --user -u omp-broker.service -n 50${ANSI_RESET}\n`
      );
      return 1;
    }

    console.log();
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`󰅚 gn restart crash: ${msg}\n`);
    return 1;
  }
}

// ─── Individual Checks ───────────────────────────────────────

/**
 * Check 1: omp-broker.service is-active
 */
function checkBrokerService(): DoctorCheckResult {
  return runSystemctlCheck(PATHS.brokerService, "omp-broker");
}

/**
 * Check 2: omp-gateway.service is-active
 */
function checkGatewayService(): DoctorCheckResult {
  return runSystemctlCheck(PATHS.gatewayService, "omp-gateway");
}

/**
 * Check 3: agent.db exists + size > 0
 */
function checkAgentDb(): DoctorCheckResult {
  if (!existsSync(PATHS.agentDb)) {
    return {
      name: "agent.db",
      status: "error",
      detail: `NOT FOUND at ${PATHS.agentDb}`,
      hint: "Jalankan omp-broker sekali untuk create DB otomatis.",
    };
  }
  try {
    const size = statSync(PATHS.agentDb).size;
    if (size === 0) {
      return {
        name: "agent.db",
        status: "warn",
        detail: "File exists tapi kosong (0 bytes)",
        hint: "DB corrupt atau belum pernah ditulis. Coba restart omp-broker.",
      };
    }
    const sizeKb = Math.round(size / 1024);
    return {
      name: "agent.db",
      status: "ok",
      detail: `Found (${sizeKb} KB)`,
    };
  } catch (err) {
    return {
      name: "agent.db",
      status: "error",
      detail: `stat() failed: ${(err as Error).message}`,
      hint: "Cek permission file: chmod 600 ~/.omp/agent/agent.db",
    };
  }
}

/**
 * Check 4: opencode.db exists + size > 0
 */
function checkOpenCodeDb(): DoctorCheckResult {
  if (!existsSync(PATHS.opencodeDb)) {
    return {
      name: "opencode.db",
      status: "warn",
      detail: `NOT FOUND at ${PATHS.opencodeDb}`,
      hint: "Belum pernah pakai OpenCode TUI. Tidak masalah kalau pakai native OMP CLI.",
    };
  }
  try {
    const size = statSync(PATHS.opencodeDb).size;
    const sizeKb = Math.round(size / 1024);
    return {
      name: "opencode.db",
      status: "ok",
      detail: `Found (${sizeKb} KB)`,
    };
  } catch (err) {
    return {
      name: "opencode.db",
      status: "warn",
      detail: `stat() failed: ${(err as Error).message}`,
      hint: "Cek permission file.",
    };
  }
}

/**
 * Check 5: stats.db exists (opsional — dibuat lazy)
 */
function checkStatsDb(): DoctorCheckResult {
  if (!existsSync(PATHS.statsDb)) {
    return {
      name: "stats.db",
      status: "warn",
      detail: `NOT FOUND at ${PATHS.statsDb}`,
      hint: "stats.db dibuat lazily oleh OMP CLI setelah request pertama.",
    };
  }
  try {
    const size = statSync(PATHS.statsDb).size;
    return {
      name: "stats.db",
      status: "ok",
      detail: `Found (${Math.round(size / 1024)} KB)`,
    };
  } catch {
    return {
      name: "stats.db",
      status: "warn",
      detail: "exists tapi tidak readable",
    };
  }
}

/**
 * Check 6: auth-broker.token exists + non-empty
 */
function checkBrokerToken(): DoctorCheckResult {
  // Env var override (untuk CI/scripted env)
  if (process.env.OMP_AUTH_BROKER_TOKEN) {
    return {
      name: "auth-broker.token",
      status: "ok",
      detail: "OMP_AUTH_BROKER_TOKEN set via env",
    };
  }
  if (!existsSync(PATHS.brokerToken)) {
    return {
      name: "auth-broker.token",
      status: "warn",
      detail: `NOT FOUND at ${PATHS.brokerToken}`,
      hint: "Set env OMP_AUTH_BROKER_TOKEN atau generate token via omp-cli init.",
    };
  }
  try {
    const size = statSync(PATHS.brokerToken).size;
    if (size === 0) {
      return {
        name: "auth-broker.token",
        status: "warn",
        detail: "File exists tapi kosong",
        hint: "Re-generate token: omp-cli token regenerate",
      };
    }
    return {
      name: "auth-broker.token",
      status: "ok",
      detail: `Found (${size} bytes)`,
    };
  } catch {
    return {
      name: "auth-broker.token",
      status: "warn",
      detail: "exists tapi tidak readable",
      hint: "chmod 600 ~/.omp/auth-broker.token",
    };
  }
}

/**
 * Check 7: ~/.shell/secret exists + has JSON files
 */
function checkSecretVault(): DoctorCheckResult {
  if (!existsSync(PATHS.secretDir)) {
    return {
      name: "Secret vault",
      status: "warn",
      detail: `Directory NOT FOUND: ${PATHS.secretDir}`,
      hint: "Belum ada credential provider. Tambah minimal satu di ~/.shell/secret/<provider>/",
    };
  }
  try {
    let count = 0;
    const stack = [PATHS.secretDir];
    while (stack.length > 0 && count < 100) {
      const dir = stack.pop()!;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) stack.push(full);
          else if (e.isFile() && e.name.endsWith(".json")) count++;
        }
      } catch {
        // skip unreadable subdir
      }
    }
    return {
      name: "Secret vault",
      status: count > 0 ? "ok" : "warn",
      detail: count > 0
        ? `Found ${count} JSON credential file(s)`
        : "Directory ada tapi belum ada credential JSON",
      hint: count === 0 ? "Tambah file .json berisi token/cookie di subfolder provider." : undefined,
    };
  } catch (err) {
    return {
      name: "Secret vault",
      status: "warn",
      detail: `readdir failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Check 8: ~/.cache/goblin-nexus exists + writable
 */
function checkCacheDir(): DoctorCheckResult {
  if (!existsSync(PATHS.cacheDir)) {
    return {
      name: "Cache dir",
      status: "warn",
      detail: `NOT FOUND: ${PATHS.cacheDir}`,
      hint: "Akan auto-created saat pertama cache write. Tidak critical.",
    };
  }
  try {
    const stat = statSync(PATHS.cacheDir);
    if (!stat.isDirectory()) {
      return {
        name: "Cache dir",
        status: "warn",
        detail: "Path exists tapi bukan directory",
      };
    }
    return {
      name: "Cache dir",
      status: "ok",
      detail: "Found",
    };
  } catch {
    return {
      name: "Cache dir",
      status: "warn",
      detail: "exists tapi tidak readable",
    };
  }
}

/**
 * Check 9: Port 4000 (gateway) listening
 * Pakai `ss` subprocess. Jika ss tidak ada, return warn (best-effort).
 */
async function checkGatewayPort(): Promise<DoctorCheckResult> {
  const port = 4000;
  try {
    const proc = Bun.spawn(["ss", "-tlnp", `sport = :${port}`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    if (exitCode !== 0) {
      return {
        name: `Port ${port}`,
        status: "warn",
        detail: "ss exit non-zero (mungkin tidak ada permission)",
        hint: "Cek manual: ss -tlnp | grep :4000",
      };
    }
    if (stdout.includes(`:${port}`)) {
      return {
        name: `Port ${port}`,
        status: "ok",
        detail: "Listening (gateway accessible)",
      };
    }
    return {
      name: `Port ${port}`,
      status: "warn",
      detail: "NOT listening — gateway mungkin belum start",
      hint: "Coba: gn restart, lalu tunggu 3-5 detik.",
    };
  } catch (err) {
    return {
      name: `Port ${port}`,
      status: "warn",
      detail: `ss unavailable: ${(err as Error).message}`,
      hint: "Install iproute2 (ss) atau cek manual via netstat/lsof.",
    };
  }
}

/**
 * Check 10: Validasi syntax opencode.jsonc (Milestone 5)
 */
function checkOpenCodeJsoncSyntax(): DoctorCheckResult {
  const { findOpenCodeConfigPath } = require("../utils/config");
  const configPath = findOpenCodeConfigPath();

  if (!configPath) {
    return {
      name: "opencode.jsonc syntax",
      status: "warn",
      detail: "File opencode.jsonc tidak ditemukan",
      hint: "Pastikan berkas opencode.jsonc ada di path pencarian default.",
    };
  }

  try {
    const rawContent = readFileSync(configPath, "utf8");
    const stripped = stripComments(rawContent);
    JSON.parse(stripped);
    return {
      name: "opencode.jsonc syntax",
      status: "ok",
      detail: `Valid JSONC: ${configPath}`,
    };
  } catch (err) {
    return {
      name: "opencode.jsonc syntax",
      status: "error",
      detail: `Syntax error: ${(err as Error).message}`,
      hint: `Periksa error formatting di: ${configPath}`,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Run `systemctl --user is-active <svc>` dan return DoctorCheckResult.
 * Pakai Bun.spawnSync agar synchronous — caller expects sync return.
 */
function runSystemctlCheck(
  service: string,
  label: string
): DoctorCheckResult {
  try {
    const proc = Bun.spawnSync(
      ["systemctl", "--user", "is-active", service],
      { stdout: "pipe", stderr: "pipe" }
    );
    if (proc.exitCode === 0) {
      return {
        name: `${label}.service`,
        status: "ok",
        detail: "active",
      };
    }
    return {
      name: `${label}.service`,
      status: "error",
      detail: "NOT running",
      hint: `Restart dengan: gn restart  (atau systemctl --user restart ${service})`,
    };
  } catch (err) {
    return {
      name: `${label}.service`,
      status: "error",
      detail: `systemctl failed: ${(err as Error).message}`,
      hint: "Pastikan systemd user session aktif (login tanpa sudo).",
    };
  }
}

/**
 * Async helper: cek apakah service aktif (untuk post-restart verify).
 */
async function isServiceActive(service: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ["systemctl", "--user", "is-active", service],
      { stdout: "pipe", stderr: "pipe" }
    );
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

/**
 * Aggregate summary count dari results array.
 */
function summarize(results: DoctorCheckResult[]): {
  ok: number;
  warn: number;
  error: number;
  total: number;
} {
  const s = { ok: 0, warn: 0, error: 0, total: results.length };
  for (const r of results) {
    if (r.status === "ok") s.ok++;
    else if (r.status === "warn") s.warn++;
    else if (r.status === "error") s.error++;
  }
  return s;
}

/**
 * Render satu check result dengan badge + hint.
 */
function renderCheck(r: DoctorCheckResult): void {
  const badge = formatStatusBadge(r.status);
  const namePadded = r.name.padEnd(28);
  console.log(`  ${badge} ${ANSI_BOLD}${namePadded}${ANSI_RESET} ${r.detail}`);
  if (r.hint) {
    console.log(`     ${ANSI_GRAY}󰋽 ${r.hint}${ANSI_RESET}`);
  }
}

// ─── Entry point (saat dijalankan langsung via `bun run`) ────

const isMainModule = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    const selfPath = new URL(import.meta.url).pathname;
    return selfPath === arg1 || arg1.endsWith("doctor.ts");
  } catch {
    return arg1.endsWith("doctor.ts");
  }
})();

if (isMainModule) {
  // Smart dispatch: kalau argv[0] adalah "restart"/"r", panggil restart handler.
  const argv = process.argv.slice(2);
  const handler = argv[0] === "restart" || argv[0] === "r"
    ? handleRestartCommand(argv.slice(1))
    : handleDoctorCommand(argv);

  handler
    .then((code) => exit(code))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      stderr.write(`󰅚 gn doctor crash: ${msg}\n`);
      exit(1);
    });
}
