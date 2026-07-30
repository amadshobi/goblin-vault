/**
 * OpenCode Configurator (OCM) — Command: Run.
 *
 * Menjalankan agent OpenCode dengan prompt kustom yang dimasukkan user.
 * Command ini memanggil binary `opencode` langsung melalui `execSync`,
 * dengan output yang di-inherit ke terminal user.
 *
 * Berguna untuk quick-run tanpa harus keluar dari OCM.
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import { execSync } from 'child_process';
import * as utils from '../utils/utils.js';

/**
 * Meminta prompt dari user lalu menjalankan `opencode` dengan prompt tersebut.
 */
export async function run(): Promise<void> {
  const promptInput = await p.text({
    message: 'Masukkan prompt perintah yang ingin dijalankan di OpenCode:',
    placeholder: 'e.g. Buatkan fungsi utilitas matematika'
  }) as string;

  if (p.isCancel(promptInput) || !promptInput.trim()) {
    return;
  }

  const activeRoot = utils.getActiveProjectRoot();
  console.log(`\n ${color.cyan(`Menjalankan OpenCode agent di workspace: ${activeRoot}...`)}\n`);

  try {
    execSync(`opencode "${promptInput.trim()}"`, { stdio: 'inherit' });
  } catch (e: any) {
    p.cancel(color.red(`Eksekusi OpenCode gagal atau dibatalkan: ${e.message}`));
  }
}
