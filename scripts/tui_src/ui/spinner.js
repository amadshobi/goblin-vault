const color = require('picocolors');

// List pesan random ala goblin
const goblinMessages = [
  "Bentar boss, goblin lagi ngitung database...",
  "Lagi ngintip session, sabar ya boss...",
  "Goblin lagi nyari kunci rahasia...",
  "Sabar boss, goblin baru bangun tidur...",
  "Menghubungi server opencode...",
  "Lagi nyari celah keamanan..."
];

function monkeySpinner(message) {
  const frames = ['🙈', '🙉', '🙊', '🙉'];
  let i = 0;
  
  process.stdout.write('\x1b[?25l'); // Sembunyikan cursor
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${color.cyan(message)}`);
    i = (i + 1) % frames.length;
  }, 350);

  return {
    stop() {
      clearInterval(interval);
      process.stdout.write('\r\x1b[K');
      process.stdout.write('\x1b[?25h'); // Munculkan cursor
    }
  };
}

/**
 * Menjalankan fungsi async dengan delayed spinner otomatis
 * @param {Function} asyncTaskFn - Fungsi yang mengembalikan Promise
 * @param {string} [customMsg] - Pesan opsional (kalau kosong, bakal acak dari goblinMessages)
 */
async function runWithSpinner(asyncTaskFn, customMsg) {
  const msg = customMsg || goblinMessages[Math.floor(Math.random() * goblinMessages.length)];
  let spinnerInstance = null;
  let isDone = false;

  // Set timeout untuk munculin spinner setelah 300ms
  const timer = setTimeout(() => {
    if (!isDone) {
      spinnerInstance = monkeySpinner(msg);
    }
  }, 100);

  try {
    const result = await asyncTaskFn();
    isDone = true;
    clearTimeout(timer);
    if (spinnerInstance) {
      spinnerInstance.stop();
    }
    return result;
  } catch (error) {
    isDone = true;
    clearTimeout(timer);
    if (spinnerInstance) {
      spinnerInstance.stop();
    }
    throw error;
  }
}

module.exports = {
  runWithSpinner,
  monkeySpinner,
  goblinMessages
};
