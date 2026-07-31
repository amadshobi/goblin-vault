/**
 * sup — Smart Universal Package Updater — Entry Point.
 *
 * Tanggung jawab entry point:
 * - Parse argumen CLI & resolve ke mode eksekusi (help / sub-command / all / interactive).
 * - Dispatch ke modul yang sesuai (help formatter, scanner, runner).
 * - Memastikan build TTY/non-TTY aman dengan detector `process.stdout.isTTY`.
 * - Mengorkestrasi permintaan `sudo` via Clack `p.password()` (lihat `sudo.ts`).
 *
 * Alur utama (high level):
 *   process.argv
 *        |
 *   parseArgs()  --help? -> showHelp() & exit
 *        |
 *        |-- sub-command / all  -> runTarget(name)
 *        |
 *        |-- (no args / TTY)    -> runInteractive()
 *        '-- (no args / pipe)   -> runAuto() (semua outdated)
 *
 * Catatan:
 * - Format banner ASCII, spinner clack, dan multiselect semuanya di-handle
 *   oleh child module (banner.ts / scan.ts / runner.ts) supaya index.ts
 *   tetap ramping & orchestration-friendly.
 * - `sudo` tidak lagi memakai `sudo -v` (yang konflik dengan UI Clack
 *   karena rebutan stdin/terminal). Sebagai gantinya kami meminta
 *   password via `p.password()` lalu mengirimnya ke `sudo -S` lewat
 *   wrapper di `exec.ts`. Modul `sudo.ts` memegang state password.
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { renderBanner } from "./banner";
import { isInteractive, roastError, warn } from "./logger";
import { showLevel1Help, showLevel2Help } from "./help";
import { findTarget, TARGETS } from "./targets";
import { runInteractive } from "./interactive";
import { runAuto } from "./auto";
import { runTarget } from "./runner";
import {
  clearSudoPassword,
  requestSudoPassword,
  targetNeedsSudo,
} from "./sudo";

/**
 * Daftar alias command target yang dikenal, termasuk `help` dan `all`.
 */
const KNOWN_SUBCMDS = new Set<string>([
  ...TARGETS.map((t) => t.id),
  "all",
  "help",
]);

/**
 * Parse argumen CLI mentah menjadi struktur opsi.
 *
 * Flag yang didukung saat ini:
 * - `-h` / `--help`           : tampilkan bantuan.
 * - `-y` / `--yes` / `--all`  : auto-update semua target.
 * - `-v` / `--verbose`        : tampilkan output package manager secara
 *                               live streaming (matikan spinner clack).
 *
 * @param rawArgs - `process.argv.slice(2)`.
 * @returns Opsi terstruktur.
 */
interface ParsedArgs {
  help: boolean;
  helpTarget: string | null;
  yesAll: boolean;
  verbose: boolean;
  target: string | null;
  unknown: string[];
}

function parseArgs(rawArgs: string[]): ParsedArgs {
  const opts: ParsedArgs = {
    help: false,
    helpTarget: null,
    yesAll: false,
    verbose: false,
    target: null,
    unknown: [],
  };
  const positional: string[] = [];

  for (const raw of rawArgs) {
    switch (raw) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-y":
      case "--yes":
      case "--all":
        opts.yesAll = true;
        break;
      case "-v":
      case "--verbose":
        opts.verbose = true;
        break;
      default:
        if (raw.startsWith("-")) {
          opts.unknown.push(raw);
        } else {
          positional.push(raw);
        }
    }
  }

  // `sup help <target>` adalah dokumen Level 2.
  if (positional[0] === "help") {
    opts.help = true;
    opts.helpTarget = positional[1] ?? null;
    return opts;
  }

  if (positional.length > 0) {
    opts.target = positional[0];
  }
  return opts;
}

/**
 * Tampilkan banner, banner-level1-help, dan exit.
 */
function printBannerAndIntro(): void {
  process.stdout.write(renderBanner() + "\n");
}

/**
 * Mode utama: cetak bantuan Level 1 dan keluar.
 */
function handleHelp(): void {
  printBannerAndIntro();
  showLevel1Help();
  process.exit(0);
}

/**
 * Mode bantuan Level 2: `sup help <target>` atau `sup <target> --help`.
 */
function handleLevel2Help(target: string): void {
  printBannerAndIntro();
  showLevel2Help(target);
  process.exit(0);
}

/**
 * Entry point utama.
 *
 * Alur:
 * 1. Parse args.
 * 2. Jika `--help` atau posisi `help`, tampilkan help (Level 1 / Level 2).
 * 3. Jika target single dikenal: jalankan langsung (skip UI).
 * 4. Jika `all` atau `--yes`: scan semua & jalankan yang outdated.
 * 5. Default (interactive mode): panggil runInteractive().
 * 6. Default (non-TTY mode): panggil runAuto() agar tetap usable di script.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.unknown.length > 0) {
    process.stdout.write(
      `\n${color.yellow("⚠️")} ${color.bold("sup")} : flag tidak dikenal ${args.unknown
        .map((u) => `"${u}"`)
        .join(", ")}\n`,
    );
    process.stdout.write(`Coba \`${color.cyan("sup --help")}\` untuk daftar lengkap.\n\n`);
  }

  if (args.help) {
    if (args.helpTarget) {
      handleLevel2Help(args.helpTarget);
    } else if (args.target) {
      handleLevel2Help(args.target);
    } else {
      handleHelp();
    }
  }

  if (args.target) {
    const lower = args.target.toLowerCase();
    if (lower === "all") {
      await runAuto({ yesAll: true, verbose: args.verbose });
      return;
    }
    const target = findTarget(lower);
    if (!target) {
      process.stdout.write(
        `\n${color.red("❌")} sup: target tidak dikenal "${color.bold(args.target)}"\n\n`,
      );
      showLevel1Help();
      process.exit(2);
    }
    printBannerAndIntro();

    // Sub-command `apt` & `snap` butuh root → minta password via Clack `p.password()`.
    // Kalau non-TTY, skip (caller bisa jalankan pakai `sudo -E` di shell host).
    if (targetNeedsSudo(lower)) {
      const ok = await ensureSudoAuth(`🔑 Target ${color.bold(lower)} butuh akses root — masukkan password sudo`);
      if (!ok) {
        process.exit(1);
      }
    }

    p.intro(color.bgCyan(color.black(` sup → ${target.label} `)));
    await runTarget(target, { verbose: args.verbose });
    p.outro(color.green("Update selesai."));
    clearSudoPassword();
    return;
  }

  // Tanpa target: tentukan mode berdasarkan TTY.
  if (!isInteractive()) {
    // Pipeline / CI: fallback auto non-interactive.
    process.stdout.write(renderBanner() + "\n");
    process.stdout.write(
      `${color.dim("ℹ️  Mode non-TTY terdeteksi — fallback ke auto-update semua.")}\n\n`,
    );
    await runAuto({ yesAll: true, verbose: args.verbose });
    return;
  }

  printBannerAndIntro();

  // Mode interaktif: kalau ada target yang butuh sudo di kandidat outdated,
  // minta password satu kali di awal lewat `p.password()`.
  const needsSudoAny = TARGETS.some((t) => targetNeedsSudo(t.id));
  if (needsSudoAny) {
    const ok = await ensureSudoAuth(
      "🔑 Sebagian target butuh akses root — masukkan password sudo (skip dengan Ctrl+C)",
    );
    if (!ok) {
      warn("Tanpa password sudo, target apt/snap akan dilewati.");
    }
  }

  await runInteractive({ yesAll: args.yesAll, verbose: args.verbose });
  clearSudoPassword();
}

/**
 * Helper internal: minta password sudo ke user lewat Clack.
 *
 * Kalau `isInteractive()` false → tidak menampilkan prompt apa pun,
 * langsung return false. Caller wajib treat ini sebagai "skip / abort".
 *
 * @param promptMessage - Pesan untuk `p.password()`.
 * @returns boolean true kalau password sudah disimpan di memori.
 */
async function ensureSudoAuth(promptMessage: string): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const pw = await requestSudoPassword(promptMessage);
  if (pw === null) {
    roastError(
      "Password sudo tidak diperoleh.",
      "Pastikan Anda menjalankan sup dari sesi terminal interaktif (TTY), atau jalankan lewat `sudo -E bun sup <target>`.",
    );
    return false;
  }
  p.log.success(`${color.green("🔓")} Password sudo tersimpan untuk sesi ini.`);
  return true;
}

main().catch((err) => {
  // Pintasan terakhir: bila sesuatu throw di luar catch — log + exit 1.
  // Gunakan console.error (bukan logger.error) untuk guarantee ke stderr.
  // eslint-disable-next-line no-console
  console.error(`\n${color.red("🔥 [sup fatal]")} ${err?.message ?? err}\n`);
  process.exit(1);
});
