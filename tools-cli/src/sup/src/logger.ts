/**
 * sup — Logger terpadu.
 *
 * Bertanggung jawab atas output terminal yang:
 * - di mode interaktif (TTY) -> dispatch ke @clack/prompts/clack primitives
 * - di mode non-interaktif (no-TTY / CI / piped) -> cetak plain text ke stdout/stderr
 *
 * Prinsip: tidak ada silent swallow. Semua pesan keluar lewat channel yang
 * jelas (`info`, `warn`, `error`, `success`, `note`, `roastError`).
 */

import * as p from "@clack/prompts";
import color from "picocolors";

/**
 * Deteksi environment interaktif.
 *
 * Menggunakan `process.stdout.isTTY` sesuai spec. False di pipeline/CI
 * akan men-disable Clack UI & fallback ke plain text logger.
 */
export const isInteractive = (): boolean =>
  Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY);

/**
 * Pesan info standar (clack note / plain console.log).
 */
export function info(message: string, title?: string): void {
  if (isInteractive()) {
    p.note(message, title);
  } else {
    const tag = title ? `[${title}] ` : "";
    console.log(`${color.cyan("ℹ️")}  ${tag}${message}`);
  }
}

/**
 * Pesan sukses dengan badge ✅.
 */
export function success(message: string): void {
  if (isInteractive()) {
    p.log.success(message);
  } else {
    console.log(`${color.green("✅")} ${message}`);
  }
}

/**
 * Pesan warning dengan badge ⚠️.
 */
export function warn(message: string): void {
  if (isInteractive()) {
    p.log.warn(message);
  } else {
    console.log(`${color.yellow("⚠️")} ${message}`);
  }
}

/**
 * Pesan error standar dengan Goblin Roast Hint.
 *
 * @param message - Pesan error utama.
 * @param hint - Opsional, hint perbaikan ramah terminal.
 */
export function roastError(message: string, hint?: string): void {
  if (isInteractive()) {
    p.log.error(`🔥 [Goblin Roast] ${message}`);
    if (hint) {
      p.log.message(`💡 Hint: ${color.yellow(hint)}`);
    }
  } else {
    console.error(`\n🔥 [Goblin Roast] ${message}`);
    if (hint) {
      console.error(`💡 Hint: ${color.yellow(hint)}`);
    }
  }
}

/**
 * Pesan step / progress kecil (clack message / plain).
 */
export function step(message: string): void {
  if (isInteractive()) {
    p.log.message(message);
  } else {
    console.log(`  ${color.dim("•")} ${message}`);
  }
}
