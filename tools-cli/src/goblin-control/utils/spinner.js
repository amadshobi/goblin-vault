import { p, color } from './constants.js';

/**
 * withSpinner — jalanin async function sambil nampilin spinner.
 * Spinner otomatis stop pas function selesai atau error.
 *
 * @param {string} message — label yang ditampilkan pas spinner jalan
 * @param {() => Promise<any>} fn — async function yang mau di-execute
 * @returns {Promise<any>} — return value dari fn
 */
export async function withSpinner(message, fn) {
  const s = p.spinner();
  s.start(message);

  try {
    const result = await fn();
    s.stop(color.green('✔') + ' ' + message);
    return result;
  } catch (err) {
    s.stop(color.red('✖') + ' ' + message);
    throw err;
  }
}
