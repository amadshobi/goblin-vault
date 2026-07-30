/**
 * OpenCode Configurator (OCM) — Spinner Interaktif Gaya Goblin.
 *
 * Menyediakan spinner terminal dengan pesan bergilir bertema Goblin
 * untuk memberikan feedback visual selama operasi berjalan.
 *
 * Fungsi ini membungkus `spinner` dari `@clack/prompts` dengan
 * tambahan rotasi pesan otomatis setiap 1.5 detik.
 */

import * as p from '@clack/prompts';
import color from 'picocolors';

/**
 * Membuat spinner kustom dengan pesan bergilir ala Goblin.
 *
 * @returns Objek dengan method `start` dan `stop`.
 *
 * @example
 * ```ts
 * const s = createSpinner();
 * s.start('Memuat data...');
 * // ... operasi async ...
 * s.stop('Selesai!', 0);
 * ```
 */
export function createSpinner() {
  const spinner = p.spinner();
  
  // Koleksi pesan yang muncul bergantian setiap 1.5 detik
  const goblinMessages = [
    'Mengaduk racikan kodingan...',
    'Memeriksa setiap sudut config...',
    'Menghubungi monster AI di sarang...',
    'Menghaluskan mantra terminal...',
    'Menata ulang memori vault...',
    'Memoles batu permata OpenCode...'
  ];
  
  let intervalId: NodeJS.Timeout | null = null;
  let msgIdx = 0;
  
  return {
    /**
     * Memulai spinner dengan pesan awal.
     * Pesan akan berganti secara otomatis setiap 1500ms.
     *
     * @param initialMsg - Pesan yang ditampilkan saat start.
     */
    start(initialMsg = 'Sedang memproses...') {
      spinner.start(initialMsg);
      msgIdx = 0;
      // Rotasi pesan secara periodik agar tidak monoton
      intervalId = setInterval(() => {
        msgIdx = (msgIdx + 1) % goblinMessages.length;
        spinner.message(color.dim(goblinMessages[msgIdx]));
      }, 1500);
    },
    
    /**
     * Menghentikan spinner dan menampilkan pesan akhir.
     *
     * @param finalMsg - Pesan yang ditampilkan saat selesai.
     * @param code     - Exit code (0 = sukses hijau, lainnya = merah).
     */
    stop(finalMsg = 'Selesai!', code = 0) {
      if (intervalId) clearInterval(intervalId);
      if (code === 0) {
        spinner.stop(color.green(` ${finalMsg}`));
      } else {
        spinner.stop(color.red(` ${finalMsg}`));
      }
    }
  };
}
