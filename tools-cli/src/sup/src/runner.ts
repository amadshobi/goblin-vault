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
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { isInteractive } from "./logger";
import type { UpdaterTarget, UpdateOutcome } from "./targets";

/**
 * Jalankan satu target dengan spinner / plain-log.
 *
 * @param target - UpdaterTarget hasil lookup.
 * @returns UpdateOutcome dari target.
 */
/**
 * Format durasi eksekusi jadi string yang ringkas + berwarna dim.
 *
 * @param durationMs - Durasi dalam milidetik.
 * @returns String dengan format `(X.Xs)` siap cetak.
 */
function formatDuration(durationMs: number): string {
  return color.dim(`(${(durationMs / 1000).toFixed(1)}s)`);
}

export async function runTarget(target: UpdaterTarget): Promise<UpdateOutcome> {
  if (!isInteractive()) {
    // Fallback text logger (tidak ada spinner).
    process.stdout.write(
      `${color.cyan("▶")}  ${color.bold(target.label)}  ${color.dim("(non-TTY)")}\n`,
    );
    const outcome = await target.update();
    const status = outcome.ok ? color.green("✅ OK") : color.red("❌ FAIL");
    process.stdout.write(
      `   ${status}  ${color.dim(outcome.message)}  ${formatDuration(outcome.durationMs)}\n\n`,
    );
    return outcome;
  }

  // TTY: pakai clack spinner.
  const spinner = p.spinner();
  spinner.start(`Memulai ${target.label}…`);
  try {
    const outcome = await target.update();
    if (outcome.ok) {
      // Sukses: tampilkan durasi sebagai info dim di sebelah pesan.
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
