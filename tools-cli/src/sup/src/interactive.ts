/**
 * sup — Mode Interaktif.
 *
 * Urutan:
 *   1. Intro clack.
 *   2. Banner dicetak oleh caller (index.ts), tapi di sini kita tampilkan intro singkat.
 *   3. Clack spinner "Scanning…" sambil `scanAll()` jalan paralel.
 *   4. Multiselect p.multiselect() berisi daftar PM yang outdated + count-nya.
 *      Mendukung granular per-package picker untuk target NPM dan PIP
 *      (lihat `OutdatedInfo.items` di targets.ts): satu entry per paket
 *      outdated, default ter-select semua sehingga user bisa Enter langsung
 *      untuk update seluruhnya, atau Space untuk toggle paket tertentu.
 *   5. Jalankan runner per target yang dipilih — satu per satu dengan spinner.
 *      Item granular diteruskan ke `target.update(selectedIds, { verbose })`.
 *   6. Outro dengan rangkuman + exit-code-aware.
 *
 * Safety:
 *   - Jika environment non-TTY, caller (index.ts) sudah route ke auto.ts.
 *   - multiselect yang di-cancel / di-EOF -> keluar sopan tanpa error.
 */

import * as p from "@clack/prompts";
import color from "picocolors";

import { isInteractive, success, warn } from "./logger";
import {
  TARGETS,
  type UpdaterTarget,
  type OutdatedInfo,
  type OutdatedItem,
  type UpdateOutcome,
} from "./targets";
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
  /**
   * Mode verbose (flag `-v` / `--verbose`). Default false → spinner
   * tenang. True → spinner dihentikan & output di-stream live.
   */
  verbose: boolean;
}

/**
 * Flatten `OutdatedInfo` dari seluruh target jadi daftar pilihan granular.
 *
 * - Kalau `info.items` tersedia (NPM, PIP, atau target lain yang expose
 *   granular per-package), setiap `OutdatedItem` jadi 1 entry pilihan
 *   dengan value = `OutdatedItem.id` (mis. "npm:opencode", "pip:requests").
 * - Kalau tidak tersedia, 1 entry pilihan dengan value = `target.id`
 *   (mis. "apt", "snap", "brew").
 *
 * Konsistensi id = `OutdatedItem.id` adalah kontrak penting: `runTarget`
 * pakai value ini sebagai `selectedIds` dan target granular akan filter
 * prefix-nya.
 *
 * @param outdated - Map id target -> OutdatedInfo.
 * @returns Array clack multiselect options.
 */
function flattenOutdatedToChoices(
  outdated: Map<string, OutdatedInfo>,
): { value: string; label: string; hint?: string }[] {
  const choices: { value: string; label: string; hint?: string }[] = [];
  for (const info of outdated.values()) {
    if (info.items && info.items.length > 0) {
      for (const item of info.items as OutdatedItem[]) {
        choices.push({
          value: item.id,
          label: item.label,
          hint: item.hint,
        });
      }
    } else {
      // Fallback: satu entry utama untuk target non-granular.
      choices.push({
        value: info.id,
        label: info.label,
        hint: info.hint,
      });
    }
  }
  return choices;
}

/**
 * Group pilihan clack kembali per target berdasarkan prefix id.
 *
 * Mapping untuk granular id: "npm:opencode" -> "npm".
 * Untuk non-granular: id == target.id, mapping langsung.
 *
 * @param selectedIds - Daftar id item pilihan dari multiselect.
 * @returns Map target.id -> string[] (subset item id untuk target tsb).
 */
function groupSelectedIdsByTarget(
  selectedIds: string[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const id of selectedIds) {
    const colonIdx = id.indexOf(":");
    const targetId = colonIdx > 0 ? id.slice(0, colonIdx) : id;
    const arr = grouped.get(targetId) ?? [];
    arr.push(id);
    grouped.set(targetId, arr);
  }
  return grouped;
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
  const choices = flattenOutdatedToChoices(outdated);
  if (!isInteractive()) {
    // Caller sudah pasti route ke mode auto kalau non-TTY.
    return choices.map((c) => c.value);
  }
  const selected = await p.multiselect({
    message:
      "Pilih target / paket yang ingin di-update (Space untuk toggle, Enter untuk jalankan semua yg terceklist):",
    options: choices,
    // PENTING (per spec UX): semua item TER-SELECT by default.
    // User bisa langsung Enter untuk update semua, atau Space untuk
    // un-select paket tertentu yang ingin dilewati.
    initialValues: choices.map((c) => c.value),
    required: false,
  });
  return selected;
}

/**
 * Mode interaktif penuh: scan -> pilih -> eksekusi -> rangkuman.
 */
export async function runInteractive(opts: InteractiveOptions): Promise<void> {
  const startedAt = Date.now();
  const verbose = opts.verbose === true;

  p.intro(color.bgCyan(color.black(" sup · Smart Universal Package Updater ")));

  // Step 1 — scanning dengan spinner.
  const scanSpinner = p.spinner();
  scanSpinner.start("🔍 Scanning package manager");
  const outdated = await scanAll();
  scanSpinner.stop(`Scan selesai — ${outdated.size} target outdated`);

  // Step 2 — kalau habis, ucapkan sukses dan keluar.
  if (outdated.size === 0) {
    success("🎉 Semua package & tool sudah up to date, BOSS!");
    p.outro(color.dim("Tidak ada yang perlu di-update."));
    return;
  }

  // Step 3 — multi-select target (granular per paket kalau tersedia).
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

  // Step 4 — group pilihan per target.id, jalankan sequential per target.
  // Untuk target granular (npm/pip), `selectedIds` berisi item id dengan
  // prefix target.id yang akan di-filter di dalam target.update().
  const grouped = groupSelectedIdsByTarget(ids);
  const outcomes: UpdateOutcome[] = [];
  for (const [targetId, perTargetIds] of grouped) {
    const target: UpdaterTarget | undefined = TARGETS.find(
      (t) => t.id === targetId,
    );
    if (!target) continue;
    // eslint-disable-next-line no-await-in-loop
    const outcome = await runTarget(target, {
      verbose,
      selectedIds: perTargetIds,
    });
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
