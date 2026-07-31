/**
 * sup — Runner eksekusi update single target.
 *
 * Bertanggung jawab memanggil `target.update()` sambil menampilkan
 * spinner (clack) di interactive mode atau plain text log di non-TTY.
 *
 * Pemisahan tanggung jawab:
 *  - `runner.ts` : orchestrator per-target (spinner + exec + outcome).
 *  - `targets.ts`: definisi detection / scan / update logic per PM.
 *  - `interactive.ts` / `auto.ts` : multi-target coordinator.
 *
 * Mode Verbose (flag `-v` / `--verbose` dari CLI):
 * - `verbose === false` (default): spinner clack tetap berputar tenang dari
 *   awal hingga selesai tiap item — output mentah stdout dist pipe
 *   (tidak di-inherit), jadi rendering spinner tidak terganggu.
 * - `verbose === true`: spinner di-pause/dihentikan dulu sebelum eksekusi,
 *   lalu `execLive(..., { inheritStdout: true })` men-stream live output
 *   package manager ke terminal user.
 *
 * Granular picker:
 * - `runTarget(target, selectedIds?)` meneruskan `selectedIds` ke
 *   `target.update(...)` sehingga target granular (npm/pip) hanya
 *   meng-update subset paket yang user pilih di multiselect.
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { isInteractive } from "./logger";
import type { UpdaterTarget, UpdateOutcome } from "./targets";

/**
 * Format durasi eksekusi jadi string yang ringkas + berwarna dim.
 *
 * @param durationMs - Durasi dalam milidetik.
 * @returns String dengan format `(X.Xs)` siap cetak.
 */
function formatDuration(durationMs: number): string {
  return color.dim(`(${(durationMs / 1000).toFixed(1)}s)`);
}

/**
 * Opsi untuk `runTarget`.
 */
export interface RunTargetOptions {
  /**
   * Mode verbose. Saat true, spinner dihentikan dulu dan output command
   * di-stream langsung ke terminal. Saat false (default), spinner
   * berputar tenang selama eksekusi tanpa bocor output mentah.
   */
  verbose?: boolean;
  /**
   * Id item granular yang dipilih user (untuk target npm/pip).
   * Format: `${target.id}:${pkgName}` (lihat `OutdatedItem.id` di targets.ts).
   * Opsional; default-nya semua paket outdated di-update.
   */
  selectedIds?: string[];
}

/**
 * Jalankan satu target dengan spinner / plain-log.
 *
 * @param target - UpdaterTarget hasil lookup.
 * @param opts - Opsional. `verbose` dan `selectedIds`.
 * @returns UpdateOutcome dari target.
 */
export async function runTarget(
  target: UpdaterTarget,
  opts: RunTargetOptions = {},
): Promise<UpdateOutcome> {
  const verbose = opts.verbose === true;

  // Non-TTY: pakai plain-text logger. Spinner clack tidak relevan di sini,
  // dan mode verbose di non-TTY hanya berarti "tidak boleh swallow stderr"
  // — execLive sudah mewariskan stderr ke terminal secara default.
  if (!isInteractive()) {
    process.stdout.write(
      `${color.cyan("▶")}  ${color.bold(target.label)}  ${color.dim("(non-TTY")}${verbose ? ", verbose" : ""}${color.dim(")")}\n`,
    );
    // eslint-disable-next-line no-await-in-loop
    const outcome = await target.update(opts.selectedIds);
    const status = outcome.ok ? color.green("✅ OK") : color.red("❌ FAIL");
    process.stdout.write(
      `   ${status}  ${color.dim(outcome.message)}  ${formatDuration(outcome.durationMs)}\n\n`,
    );
    return outcome;
  }

  // TTY + mode quiet (default). Spinner boleh tetap jalan selama eksekusi.
  if (!verbose) {
    const spinner = p.spinner();
    spinner.start(`Memulai ${target.label}…`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await target.update(opts.selectedIds);
      if (outcome.ok) {
        spinner.stop(
          `${color.green("✅")} ${target.label} — ${outcome.message} ${formatDuration(outcome.durationMs)}`,
        );
      } else {
        spinner.stop(
          `${color.red("❌")} ${target.label} — ${outcome.message} ${formatDuration(outcome.durationMs)}`,
        );
      }
      return outcome;
    } catch (err: any) {
      spinner.stop(
        `${color.red("❌")} ${target.label} — ${err?.message ?? String(err)}`,
      );
      return {
        id: target.id,
        label: target.label,
        ok: false,
        message: err?.message ?? String(err),
        durationMs: 0,
      };
    }
  }

  // TTY + mode verbose. Spinner harus di-stop DULU agar renderer clack
  // tidak tabrakan dengan streaming output dari spawned process.
  // Pakai spinner start-stop cepat sebagai placeholder sebelum exec, dan
  // emit p.log.message sebagai header supaya jelas transisi ke mode live.
  const header = p.spinner();
  header.start(`Memulai ${target.label}… (verbose)`);
  header.stop(`▶ ${color.bold(target.label)} — mode verbose (live output)`);
  try {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await target.update(opts.selectedIds);
    // Cetak ringkasan finale (mirip spinner.stop()) setelah output mentah
    // selesai di-stream. Pakai p.log.* agar konsisten dengan renderer.
    if (outcome.ok) {
      p.log.success(
        `${color.green("✅")} ${target.label} — ${outcome.message} ${formatDuration(outcome.durationMs)}`,
      );
    } else {
      p.log.error(
        `${color.red("❌")} ${target.label} — ${outcome.message} ${formatDuration(outcome.durationMs)}`,
      );
    }
    return outcome;
  } catch (err: any) {
    p.log.error(
      `${color.red("❌")} ${target.label} — ${err?.message ?? String(err)}`,
    );
    return {
      id: target.id,
      label: target.label,
      ok: false,
      message: err?.message ?? String(err),
      durationMs: 0,
    };
  }
}
