/**
 * Delete Module — hapus file dengan fzf multi-select.
 *
 * Flow:
 * 1. Pilih directory root (default: current dir)
 * 2. fzf multi-select dari file di bawah directory (skip node_modules, .git)
 * 3. Konfirmasi destructive
 * 4. Eksekusi delete dengan spinner
 * 5. Tampilkan hasil (success + failed files)
 */

import fs from 'fs';
import path from 'path';
import { p, color } from '../../utils/constants.js';
import { resolvePath, pathExists, isDirectory } from '../../utils/fs.js';
import { execCommand } from '../../utils/exec.js';
import { withSpinner } from '../../utils/spinner.js';
import { confirmDestructive } from '../../utils/guards.js';
import { handleCancel, clearLastLines } from '../../utils/prompts.js';

export async function main() {
  // ── 1. Pilih directory root ────────────────────────────────────────────────
  const dirInput = await p.text({
    message: 'Search files in directory:',
    placeholder: '. (current directory)',
    initialValue: '.',
  });

  if (handleCancel(dirInput)) {
    clearLastLines(4);
    return;
  }

  const rootDir = resolvePath(dirInput.trim() || '.');

  // Validasi directory
  if (!pathExists(rootDir)) {
    console.log(color.red('Error:') + ' Directory does not exist — ' + rootDir);
    return;
  }

  if (!isDirectory(rootDir)) {
    console.log(color.red('Error:') + ' Path is not a directory — ' + rootDir);
    return;
  }

  // ── 2. Multi-select file via fzf ───────────────────────────────────────────
  const findCmd = `find "${rootDir}" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null`;
  const fzfCmd = `${findCmd} | fzf --multi --height=60% --preview='head -100 {}' --prompt='Select files to delete > '`;

  let selectedOutput;

  try {
    selectedOutput = await withSpinner('Loading files...', async () => {
      const result = await execCommand(fzfCmd);
      return result;
    });
  } catch (err) {
    console.log(color.red('Error running fzf:') + ' ' + err.message);
    return;
  }

  // Parse hasil fzf
  const selectedFiles = selectedOutput.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((f) => f.trim());

  // ── 3. Kalo user cancel / no selection → langsung balik ────────────────
  if (selectedFiles.length === 0) return;

  // ── 4. Confirmation ────────────────────────────────────────────────────────
  console.log(color.dim(`\nFiles to delete (${selectedFiles.length}):`));
  selectedFiles.forEach((f) => console.log(color.dim(`  • ${f}`)));

  const confirmed = await confirmDestructive(
    `Delete ${selectedFiles.length} file(s)? This cannot be undone.`
  );

  if (handleCancel(confirmed)) {
    clearLastLines(5);
    return;
  }
  if (!confirmed) {
    console.log(color.yellow('Operation cancelled.'));
    return;
  }

  // ── 5. Execute delete ──────────────────────────────────────────────────────
  const failedFiles = [];

  await withSpinner(`Deleting ${selectedFiles.length} file(s)...`, async () => {
    for (const filePath of selectedFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        failedFiles.push(filePath);
        // Lanjut ke file berikutnya — jangan throw
      }
    }
  });

  // ── 6. Result ──────────────────────────────────────────────────────────────
  const successCount = selectedFiles.length - failedFiles.length;
  console.log(color.green(`\nDeleted: ${successCount} file(s)`));

  if (failedFiles.length > 0) {
    console.log(color.red(`Failed: ${failedFiles.length} file(s)`));
    failedFiles.forEach((f) => console.log(color.dim(`  ✖ ${f}`)));
  }
}
