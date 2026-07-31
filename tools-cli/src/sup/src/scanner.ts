/**
 * sup — Parallel Scanner.
 *
 * Scan semua target secara paralel (read-only) untuk mengumpulkan
 * daftar package manager yang outdated.
 *
 * Kenapa paralel aman?
 *  - Semua command yang dipanggil adalah READ-ONLY (list / list --outdated).
 *  - Tidak ada side-effect ke filesystem system-wide.
 *  - Promise.all pada command kecil (sub-detik sampai ~30 detik untuk `brew outdated`).
 *
 * Modul ini dipakai oleh:
 *  - `interactive.ts` untuk populate multiselect.
 *  - `auto.ts` untuk loop update otomatis.
 */

import { TARGETS, type UpdaterTarget, type OutdatedInfo } from "./targets";

/**
 * Filter target yang tersedia di sistem (command -v check).
 *
 * @returns Array target yang terdeteksi.
 */
async function detectedTargets(): Promise<UpdaterTarget[]> {
  const out: UpdaterTarget[] = [];
  for (const t of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    if (await t.detect()) out.push(t);
  }
  return out;
}

/**
 * Scan paralel untuk seluruh target yang terdeteksi.
 *
 * @returns Map id -> OutdatedInfo. Kosong kalau semua up-to-date atau tak ada target.
 */
export async function scanAll(): Promise<Map<string, OutdatedInfo>> {
  const detected = await detectedTargets();
  if (detected.length === 0) return new Map();

  const scans = await Promise.all(detected.map((t) => t.scan()));
  const result = new Map<string, OutdatedInfo>();
  scans.forEach((info, idx) => {
    const t = detected[idx];
    if (info) result.set(t.id, info);
  });
  return result;
}
