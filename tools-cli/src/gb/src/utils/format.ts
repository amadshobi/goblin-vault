/**
 * utils/format.ts — Pusat helper visual formatting (TS)
 *
 * Helper ini dipakai lintas-domain (profile, pr, issue) untuk render
 * output terminal dengan ANSI yang presisi:
 *   - stripAnsi      : hapus semua ANSI escape codes
 *   - visualLength   : hitung lebar visual string (ignore ANSI)
 *   - padVisual      : pad kanan sesuai lebar visual
 *   - truncateVisual : potong string dengan mempertahankan ANSI codes
 *   - centerVisual   : center string dalam lebar visual tertentu
 *   - clearLastLines : hapus N baris terakhir dari terminal (ANSI escape)
 *
 * Domain-specific helpers (e.g. `truncate` plain-string di PR/Issue view)
 * tetap dilokalisasi di modul domain masing-masing.
 *
 * Catatan: shared module ini cuma berisi pure utility. Tidak ada dependency
 * ke services lain agar reusable lintas domain.
 */

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const ANSI_TOKEN_PATTERN = /\x1b\[[0-9;]*m|[^\x1b]/g;

/** Hapus semua ANSI escape codes dari string. */
export function stripAnsi(str: string | null | undefined): string {
  return String(str).replace(ANSI_PATTERN, "");
}

/** Hitung lebar visual string (tanpa menghitung ANSI codes). */
export function visualLength(str: string | null | undefined): number {
  return stripAnsi(str).length;
}

/** Potong string ke maxLen visual, pertahankan ANSI codes. */
export function truncateVisual(str: string | null | undefined, maxLen: number): string {
  if (!str) return "";
  if (visualLength(str) <= maxLen) return String(str);
  const limit = Math.max(0, maxLen - 3);
  let out = "";
  let visible = 0;
  const tokens = String(str).match(ANSI_TOKEN_PATTERN) || [];
  for (const tok of tokens) {
    if (tok[0] === "\x1b") {
      out += tok;
      continue;
    }
    if (visible >= limit) break;
    out += tok;
    visible++;
  }
  const reset = ANSI_PATTERN.test(str) ? "\x1b[0m" : "";
  return out + "..." + reset;
}

/** Pad string ke targetLen visual. */
export function padVisual(str: string | null | undefined, targetLen: number): string {
  const pad = targetLen - visualLength(str);
  return pad > 0 ? String(str) + " ".repeat(pad) : String(str);
}

/** Center string dalam lebar visual tertentu. */
export function centerVisual(str: string | null | undefined, targetLen: number): string {
  const visual = visualLength(str);
  if (visual >= targetLen) return String(str);
  const totalPad = targetLen - visual;
  const left = Math.floor(totalPad / 2);
  const right = totalPad - left;
  return " ".repeat(left) + String(str) + " ".repeat(right);
}

/** Hapus N baris terakhir dari terminal (ANSI escape). */
export function clearLastLines(numLines = 2): void {
  for (let i = 0; i < numLines; i++) {
    process.stdout.write("\x1b[1A\x1b[2K");
  }
}