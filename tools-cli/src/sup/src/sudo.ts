/**
 * sup — Modul manajemen kredensial sudo.
 *
 * Tujuan:
 * - Menghindari tabrakan TTY antara prompt `sudo` bawaan dengan UI Clack.
 *   Biasanya `sudo -v` dengan `stdio: "inherit"` akan gagal dengan pesan
 *   "sudo: A terminal is required to authenticate" ketika stdin sudah dipakai
 *   oleh interactive UI/Clack spinner.
 *
 * Solusi:
 * - Meminta password dari user via `p.password()` (komponen interaktif Clack)
 *   SEKALI di awal sesi (kalau target yang akan dijalankan butuh root).
 * - Password disimpan di memori (variabel module-private) selama sesi berjalan,
 *   dan dipakai oleh wrapper eksekusi command di `exec.ts` dengan cara dikirim
 *   via `sudo -S` (read password from stdin).
 *
 * Aturan keamanan & UX:
 * - Hanya meminta password kalau `isInteractive()` true. Di mode non-TTY
 *   (pipeline / CI) kita skip — caller diharapkan sudah di-root atau disable
 *   sudo target via konfigurasi.
 * - Password tidak pernah dicetak ke stdout/stderr (tidak ada `console.log(password)`)
 *   dan tidak pernah dipersist ke file.
 * - Setelah sesi selesai, `clearSudoPassword()` dipanggil dari orchestrator
 *   supaya tidak tertinggal di memori.
 */

import * as p from "@clack/prompts";

/**
 * Daftar id target yang butuh hak akses root untuk update.
 *
 * Saat ini hanya `apt` (Debian/Ubuntu) dan `snap` yang umum butuh sudo.
 * Daftar ini dipakai baik di flow `sup <target>` maupun mode interaktif,
 * supaya `p.password()` hanya diminta kalau memang ada target yang Butuh.
 */
export const SUDO_REQUIRED_TARGETS: ReadonlySet<string> = new Set<string>([
  "apt",
  "snap",
]);

/**
 * Module-scoped holder untuk password. TIDAK dipersist ke mana pun.
 * Private by convention — akses hanya lewat helper di bawah.
 */
let cachedPassword: string | null = null;

/**
 * Cek apakah environment saat ini bisa meminta password via Clack UI.
 *
 * @returns boolean true kalau aman memunculkan p.password().
 */
export function canPromptForSudo(): boolean {
  return Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY);
}

/**
 * Cek apakah target tertentu butuh sudo.
 *
 * @param targetId - id target, misal "apt", "snap".
 * @returns boolean.
 */
export function targetNeedsSudo(targetId: string): boolean {
  return SUDO_REQUIRED_TARGETS.has(targetId.toLowerCase());
}

/**
 * Cek apakah password sudo sudah tersedia di memori.
 *
 * @returns boolean.
 */
export function hasSudoPassword(): boolean {
  return cachedPassword !== null && cachedPassword.length > 0;
}

/**
 * Ambil password yang sudah tersimpan (jangan dicetak/log!).
 *
 * @returns Password string atau null kalau belum diminta.
 */
export function getSudoPassword(): string | null {
  return cachedPassword;
}

/**
 * Set password secara eksplisit (dipakai oleh helper Clack + testing).
 *
 * @param password - Password sudo dari user.
 */
export function setSudoPassword(password: string): void {
  cachedPassword = password;
}

/**
 * Bersihkan password dari memori. Dipanggil di akhir sesi / saat exit.
 * Implementation note: overwrite buffer lalu null-kan reference. JS string
 * immutable jadi praktik overwrite cuma untuk menahan reference.
 *
 * Catatan UX: kalau sebelumnya memang ada password tersimpan, tampilkan
 * log singkat (dim) supaya user tahu bahwa kredensial sudah diam-diam
 * dibersihkan dari memori sesi — bukan tiba-tiba "hilang" tanpa jejak.
 */
export function clearSudoPassword(): void {
  if (hasSudoPassword()) {
    // Pemberitahuan sebelum null-kan reference; di sini kita masih tahu
    // bahwa memang ada password yang tersimpan.
    // Pakai stdout langsung (bukan console.log Clack) agar konsisten
    // dengan log cleanup yang ringan & non-blocking.
    // eslint-disable-next-line no-console
    console.log(
      `${"\x1b[2m🔒 Password sudo dibersihkan dari memori sesi.\x1b[0m"}`,
    );
  }
  cachedPassword = null;
}

/**
 * Request password sudo dari user via Clack `p.password()`.
 *
 * - Kalau password sudah tersimpan, langsung return.
 * - Kalau non-TTY, return null (caller handle fallback).
 * - Kalau user cancel (Ctrl+C / Esc), return null.
 *
 * @param message - Pesan prompt opsional.
 * @returns Password string (disimpan di memori) atau null kalau dilewati/cancel.
 */
export async function requestSudoPassword(
  message: string = "🔐 Masukkan password sudo untuk melanjutkan",
): Promise<string | null> {
  if (hasSudoPassword()) {
    return cachedPassword;
  }
  if (!canPromptForSudo()) {
    // Non-interactive: skip — caller akan fallback atau abort.
    return null;
  }
  const value = await p.password({
    message,
    mask: "*",
    validate: (input: string | undefined) => {
      if (!input || input.length === 0) {
        return "Password tidak boleh kosong";
      }
      return undefined;
    },
  });
  if (p.isCancel(value) || typeof value !== "string") {
    return null;
  }
  cachedPassword = value;
  return cachedPassword;
}
