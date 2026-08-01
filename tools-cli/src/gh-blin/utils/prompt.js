const p = require('@clack/prompts');

/**
 * Pause sampai user menekan Enter. Kalau user cancel (Ctrl+C / ESC), program
 * keluar dengan aman — mencegah Unhandled Rejection atau lanjut tanpa arah.
 * @returns {Promise<true>}
 */
async function continuePrompt() {
  let res;
  try {
    res = await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
  } catch (err) {
    // Prompt gagal (TTY tertutup, dll.) — keluar aman, jangan Unhandled Rejection.
    // process.exit di luar try block agar exit code tidak tertimpa oleh catch.
    console.error(err.message || err);
    process.exit(1);
  }
  if (p.isCancel(res)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }
  return true;
}

module.exports = { continuePrompt };
