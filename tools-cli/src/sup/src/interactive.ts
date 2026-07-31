/**
 * sup — Mode Interaktif.
 *
 * Urutan:
 *   1. Intro clack.
 *   2. Banner dicetak oleh caller (index.ts), tapi di sini kita tampilkan intro singkat.
 *   3. Clack spinner "Scanning…" sambil `scanAll()` jalan paralel.
 *   4. Multiselect p.multiselect() berisi daftar PM yang outdated + count-nya.
 *   5. Jalankan runner per target yang dipilih — satu per satu dengan spinner.
 *   6. Outro dengan rangkuman + exit-code-aware.
 *
 * Safety:
 *   - Jika environment non-TTY, caller (index.ts) sudah route ke auto.ts.
 *   - multiselect yang di-cancel / di-EOF -> keluar sopan tanpa error.
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { isInteractive, success, warn } from "./logger";
import { TARGETS, type UpdaterTarget, type OutdatedInfo, type UpdateOutcome } from "./targets";
import { runTarget } from "./runner";
import { scanAll } from "./scanner";

/**
 * Tampilkan daftar target yang gagal + pesan error-nya.
 *
 * Konsisten dengan helper serupa di `auto.ts` — dipisah per modul untuk
 * menjaga low coupling; kalau format perlu diubah cukup edit di satu tempat
 * per mode (interactive vs auto) tanpa menyentuh keduanya.
 *
 * @param outcomes - Hasil eksekusi update per target.
 */
function showFailedDetails(outcomes: UpdateOutcome[]): void {
  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length === 0) return;

  const lines = failed.map(
    (o) => `  ${color.red("✗")} ${color.bold(o.label)} — ${o.message}`,
  );
  const block = [`${failed.length} target gagal:`, ...lines].join("\n");

  if (isInteractive()) {
    p.note(block, "Detail Kegagalan");
  } else {
    process.stdout.write(`\n${color.bold("Detail Kegagalan")}\n${block}\n`);
  }
}

interface InteractiveOptions {
  /**
   * Dipakai kalau user sebelumnya pass `--yes`. Mode interaktif murni
   * (default) abaikan flag ini. Disimpan agar signature stabil untuk caller.
   */
  yesAll: boolean;
}

/**
 * Render pilihan multi-select dari daftar outdated targets.
 *
 * @param outdated - Map hasil scan.
 * @returns Array pilihan id target untuk dijalankan, atau null kalau user cancel.
 */
async function chooseTargets(
  outdated: Map<string, OutdatedInfo>,
): Promise<string[] | symbol | null> {
  if (outdated.size === 0) return [];
  const choices = [...outdated.values()].map((info) => ({
    value: info.id,
    label: info.label,
    hint: info.hint,
  }));
  if (!isInteractive()) {
    // Caller sudah pasti route ke mode auto kalau non-TTY.
    return choices.map((c) => c.value);
  }
  const selected = await p.multiselect({
    message: "Pilih target yang ingin di-update (Space untuk toggle):",
    options: choices,
    initialValues: choices.map((c) => c.value), // default semua
    required: false,
  });
  return selected;
}

/**
 * Mode interaktif penuh: scan -> pilih -> eksekusi -> rangkuman.
 */
export async function runInteractive(opts: InteractiveOptions): Promise<void> {
  void opts; // signature stabilizer
  const startedAt = Date.now();

  p.intro(color.bgCyan(color.black(" sup · Smart Universal Package Updater ")));

  // Step 1 — scanning dengan spinner.
  const scanSpinner = p.spinner();
  scanSpinner.start("🔍 Scan package manager paralel…");
  const outdated = await scanAll();
  scanSpinner.stop(`Scan selesai — ${outdated.size} target outdated`);

  // Step 2 — kalau habis, ucapkan sukses dan keluar.
  if (outdated.size === 0) {
    success("🎉 Semua package & tool sudah up to date, BOSS!");
    p.outro(color.dim("Tidak ada yang perlu di-update."));
    return;
  }

  // Step 3 — multi-select target.
  const ids = await chooseTargets(outdated);
  if (typeof ids === "symbol") {
    // user cancel via Ctrl+C / Esc
    warn("Dibatalkan oleh user. Tidak ada package yang di-update.");
    p.outro(color.dim("Sesi dihentikan."));
    return;
  }
  if (!ids || ids.length === 0) {
    warn("Tidak ada target yang dipilih.");
    p.outro(color.dim("Tidak ada perubahan yang dilakukan."));
    return;
  }

  // Step 4 — eksekusi sequential.
  const outcomes: UpdateOutcome[] = [];
  for (const id of ids) {
    const target: UpdaterTarget | undefined = TARGETS.find((t) => t.id === id);
    if (!target) continue;
    // eslint-disable-next-line no-await-in-loop
    const outcome = await runTarget(target);
    outcomes.push(outcome);
  }

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const ok = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - ok;

  if (failed === 0) {
    success(`🎉 Semua ${ok} target selesai update tanpa error. BOSS, system & packages segar! 🚀`);
  } else {
    warn(`Selesai dengan catatan: ${ok} sukses, ${failed} gagal. Lihat output di atas.`);
  }

  showFailedDetails(outcomes);

  p.outro(color.dim(`Waktu total: ${totalSec}s`));
  if (failed > 0) process.exitCode = 1;
}
