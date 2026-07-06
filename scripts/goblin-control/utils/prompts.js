import { p, color } from './constants.js';

/**
 * confirmAction — wrapper untuk clack confirm dengan default false.
 * Biar ada konfirmasi sebelum action penting.
 */
export async function confirmAction(message = 'Are you sure?') {
  return p.confirm({
    message,
    initialValue: false,
  });
}

/**
 * showBackMessage — print helper biar user tau cara balik.
 */
export function showBackMessage() {
  console.log(color.dim('\nPress any key to go back...'));
}

/**
 * handleCancel — cek isCancel, kalo iya: cancel().
 * Return true kalo cancel, false kalo lanjut.
 */
export function handleCancel(value) {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    return true;
  }
  return false;
}

/**
 * clearLastLines — hapus N baris terakhir dari terminal.
 * Panggil sebelum return/break pas cancel, biar prompt gak numpuk.
 * @param {number} numLines
 */
export function clearLastLines(numLines) {
  for (let i = 0; i < numLines; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }
}
