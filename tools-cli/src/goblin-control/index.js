#!/usr/bin/env node

/**
 * Goblin Control Panel — entry point.
 *
 * Flow:
 *   1. Tampilin intro
 *   2. Loop main menu pake select()
 *   3. Pilih module → import + jalanin main()
 *   4. Balik ke menu setelah module selesai (kecuali Exit / Cancel)
 *   5. Handle cancel di setiap prompt
 */

import { p, color, APP_NAME } from './utils/constants.js';

async function main() {
  p.intro(color.bold(color.bgBlack(color.white(` ${APP_NAME} `))));

  while (true) {
    const action = await p.select({
      message: 'Pilih module:',
      options: [
        { value: 'git',       label: 'Git',       hint: 'acp,branch,clone' },
        { value: 'create',    label: 'Create',    hint: 'file,folder' },
        { value: 'delete',    label: 'Delete',    hint: 'file via fzf' },
        { value: 'shortcuts', label: 'Shortcuts', hint: 'gb,ocm,fe' },
        { value: 'cmd',       label: 'Cmd',       hint: 'linux cmd' },
        { value: 'check',     label: 'Check',     hint: 'doctor,lint' },
        { value: 'exit',      label: color.red('Exit'), hint: 'keluar' },
      ],
    });

    // Cancel → keluar total
    if (p.isCancel(action)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Exit → outro + keluar
    if (action === 'exit') {
      p.outro(`${color.green('See you later, goblin!')} 👋`);
      process.exit(0);
    }

    // Import module dynamically + jalanin main()
    try {
      const mod = await import(`./modules/${action}/index.js`);
      await mod.main();
    } catch (err) {
      console.error(color.red(`Gagal load module "${action}":`), err.message);
    }

    // Bersihin layar + intro ulang setiap balik ke main menu
    process.stdout.write('\x1b[H\x1b[2J');
    p.intro(color.bold(color.bgBlack(color.white(` ${APP_NAME} `))));
  }
}

main().catch((err) => {
  console.error(color.red('Fatal error:'), err);
  process.exit(1);
});
