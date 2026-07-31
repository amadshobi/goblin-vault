/**
 * sup — Mode Auto.
 *
 * Scan seluruh target via paralelisme (aman: pakai Promise.all, tapi yang dieksekusi
 * cuma command kecil & read-only). Hasilnya: jalankan update SE-QUENTIAL karena banyak
 * package manager (apt, brew) yang tidak boleh overlap dan kebanyakan butuh sudo.
 *
 * Alur:
 *   1. untuk semua target, jalankan `detect()` filter dulu supaya skip total kalau
 *      command-nya tidak ada di PATH (sehingga tidak spam error);
 *   2. `scan()` paralel untuk yang detect = true -> kumpulkan outdated;
 *   3. eksekusi `update()` satu per satu dengan `runTarget()`;
 *   4. rangkuman total di akhir.
 *
 * Mode ini dipanggil dari:
 *   - `sup all` (eksplisit user);
 *   - `sup --yes`;
 *   - fallback non-TTY (pipeline / CI).
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { isInteractive } from "./logger";
import { TARGETS, type UpdateOutcome } from "./targets";
import { runTarget } from "./runner";
import { scanAll } from "./scanner";
import {
  requestSudoPassword,
  targetNeedsSudo,
} from "./sudo";

interface AutoOptions {
  /**
   * true = skip semua prompt (untuk `sup all`, `--yes`, atau non-TTY default).
   */
  yesAll: boolean;
}

/**
 * Tampilkan rangkuman akhir + return exit code yang sesuai.
 *
 * @param outcomes - Hasil eksekusi update per target.
 */
function summarize(outcomes: UpdateOutcome[]): void {
  const ok = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - ok;
  if (isInteractive()) {
    if (failed === 0) {
      p.log.success(
        `🎉 Semua ${ok} target selesai update tanpa kesalahan. BOSS, system & packages segar! 🚀`,
      );
    } else {
      p.log.warn(`⚠️ Selesai dengan catatan: ${ok} sukses, ${failed} gagal.`);
    }
  } else {
    process.stdout.write(
      `\n${color.bold("Rangkuman")}: ${color.green(ok + " sukses")}, ${color.red(
        failed + " gagal",
      )}\n`,
    );
  }
}

/**
 * Eksekusi mode auto. Scan semua -> update yang outdated -> rangkuman.
 */
export async function runAuto(opts: AutoOptions): Promise<void> {
  const startedAt = Date.now();

  if (isInteractive()) {
    p.intro(color.bgMagenta(color.white(" sup · auto-update semua ")));
  }

  const spinner = isInteractive() ? p.spinner() : null;
  if (spinner) spinner.start("🔍 Scan package manager paralel…");
  const outdated = await scanAll();
  if (spinner) spinner.stop(`Scan selesai — ${outdated.size} target outdated`);

  if (outdated.size === 0) {
    if (isInteractive()) {
      p.log.success("🎉 Semua package & tool sudah up to date, BOSS!");
    } else {
      process.stdout.write(
        `${color.green("🎉")} Semua package & tool sudah up to date, BOSS!\n`,
      );
    }
    if (spinner) {
      p.outro(color.dim(`Waktu total: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`));
    }
    return;
  }

  // Cek apakah ada target outdated yang butuh sudo (apt/snap).
  // Minta password sebelum update loop agar execLive() bisa kirim via stdin
  // (stdin: "pipe" + sudo -S) dan tidak rebutan TTY dengan Clack spinner.
  const needsSudo = [...outdated.keys()].some((id) => targetNeedsSudo(id));
  if (needsSudo && isInteractive()) {
    const pw = await requestSudoPassword(
      "🔑 Target apt/snap butuh akses root — masukkan password sudo",
    );
    if (pw === null) {
      p.log.warn("⚠️  Tanpa password sudo, target apt/snap mungkin gagal karena tidak bisa autentikasi.");
    }
  }

  // Eksekusi sequential (1 per 1) untuk menghindari lock conflict (apt/dpkg/dnf).
  const outcomes: UpdateOutcome[] = [];
  for (const [id, info] of outdated) {
    const target = TARGETS.find((t) => t.id === id);
    if (!target) continue;
    void info; // info saat ini dipakai di UI saja; outcome ada di UpdateOutcome.
    // eslint-disable-next-line no-await-in-loop
    const outcome = await runTarget(target);
    outcomes.push(outcome);
  }

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  summarize(outcomes);

  if (isInteractive()) {
    p.outro(color.dim(`Waktu total: ${totalSec}s`));
  } else {
    process.stdout.write(`${color.dim(`Waktu total: ${totalSec}s`)}\n`);
  }

  const failed = outcomes.some((o) => !o.ok);
  if (failed) process.exitCode = 1;
  void opts; // future: opts.yesAll bisa skip prompt konfirmasi final (saat ini sudah otomatis).
}
