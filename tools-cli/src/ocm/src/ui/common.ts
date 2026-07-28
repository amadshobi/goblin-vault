/**
 * OpenCode Configurator (OCM) — Komponen UI Umum.
 *
 * Berisi fungsi-fungsi rendering terminal yang digunakan bersama oleh
 * berbagai command dan menu. Utility utama di sini adalah `drawBox`
 * untuk menggambar kotak border dengan judul di terminal.
 *
 * Modul ini sengaja dipisahkan dari `menu.ts` dan `dashboard.ts` agar
 * fungsi rendering dasar bisa di-reuse tanpa menarik dependensi sirkuler.
 */

import color from 'picocolors';

/**
 * Menghapus kode ANSI escape dari sebuah string.
 *
 * Berguna untuk menghitung panjang visual string di terminal tanpa
 * terpengaruh oleh karakter kontrol warna/bold/dim.
 *
 * @param str - String yang mungkin mengandung kode ANSI.
 * @returns String bersih tanpa kode ANSI.
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Menggambar kotak border dengan judul di terminal.
 *
 * Membuat bingkai seperti:
 * ```
 * ┌─ Judul ────────────────────┐
 * │ Baris konten                │
 * │ Baris lainnya               │
 * └─────────────────────────────┘
 * ```
 *
 * Lebar kotak otomatis menyesuaikan dengan konten terpanjang (termasuk judul).
 *
 * @param title - Judul yang ditampilkan di border atas (mendukung ANSI color).
 * @param lines - Array baris konten di dalam kotak.
 */
export function drawBox(title: string, lines: string[]): void {
  const cleanTitle = stripAnsi(title);
  let maxLen = cleanTitle.length;
  
  for (const line of lines) {
    const len = stripAnsi(line).length;
    if (len > maxLen) maxLen = len;
  }
  
  const width = maxLen + 4;
  const topBorder = '┌─ ' + color.bold(title) + ' ' + '─'.repeat(Math.max(0, width - cleanTitle.length - 4)) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  
  console.log(color.cyan(topBorder));
  for (const line of lines) {
    const cleanLine = stripAnsi(line);
    const padding = ' '.repeat(Math.max(0, width - cleanLine.length - 3));
    console.log(color.cyan('│ ') + line + padding + color.cyan('│'));
  }
  console.log(color.cyan(bottomBorder));
}
