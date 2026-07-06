/**
 * Create Module — buat file atau folder baru.
 *
 * Flow:
 * 1. Pilih tipe (File / Folder) — auto-detect kalo path berakhiran /
 * 2. Input path (relatif, absolut, ~/)
 * 3. Conflict handling: overwrite file, skip existing folder
 * 4. Auto-create parent directory kalo belum ada
 * 5. Post-create: file bisa langsung dibuka di micro
 */

import fs from 'fs';
import path from 'path';
import { p, color } from '../../utils/constants.js';
import { resolvePath, pathExists, isDirectory } from '../../utils/fs.js';
import { withSpinner } from '../../utils/spinner.js';
import { confirmAction, handleCancel, clearLastLines } from '../../utils/prompts.js';
import { openInMicro } from '../../utils/editor.js';

export async function main() {
  // ── 1. Pilih tipe ──────────────────────────────────────────────────────────
  const typeChoice = await p.select({
    message: 'What do you want to create?',
    options: [
      { value: 'auto', label: 'Auto-detect', hint: 'otomatis' },
      { value: 'file', label: 'File', hint: 'file baru' },
      { value: 'folder', label: 'Folder', hint: 'folder baru' },
    ],
  });

  if (handleCancel(typeChoice)) {
    clearLastLines(6);
    return;
  }

  // ── 2. Input path ──────────────────────────────────────────────────────────
  const rawPath = await p.text({
    message: 'Enter path:',
    placeholder: 'src/utils/helper.js',
    validate: (val) => {
      if (!val || !val.trim()) return 'Path cannot be empty';
      return;
    },
  });

  if (handleCancel(rawPath)) {
    clearLastLines(4);
    return;
  }

  const inputPath = rawPath.trim();
  const resolvedPath = resolvePath(inputPath);

  // ── 3. Auto-detect file vs folder ──────────────────────────────────────────
  // Aturan:
  //   - Path berakhiran / → folder
  //   - Path udah ada dan isDirectory → folder
  //   - Selainnya → file (default)
  let isDir = false;

  if (inputPath.endsWith('/')) {
    isDir = true;
  } else if (pathExists(resolvedPath) && isDirectory(resolvedPath)) {
    isDir = true;
  } else if (typeChoice === 'folder') {
    isDir = true;
  } else if (typeChoice === 'file') {
    isDir = false;
  } else {
    // auto-detect: kalo user specify extension, kemungkinan file
    const ext = path.extname(resolvedPath);
    isDir = !ext; // kalo ga ada extension, treat as folder
  }

  const typeLabel = isDir ? 'folder' : 'file';

  console.log(color.dim(`  Detected: ${typeLabel}`));

  // ── 4. Conflict handling ───────────────────────────────────────────────────
  if (pathExists(resolvedPath)) {
    if (isDir) {
      // Folder udah ada — tanya mau lanjut aja
      const proceed = await confirmAction(
        `Folder ${color.cyan(resolvedPath)} already exists. Continue?`
      );
      if (handleCancel(proceed)) {
        clearLastLines(5);
        return;
      }
      if (!proceed) return;

      console.log(color.green('✔') + ' ' + resolvedPath);
      return;
    }

    // File udah ada — tanya overwrite
    const overwrite = await confirmDestructive(
      `File ${color.cyan(resolvedPath)} already exists. Overwrite?`
    );
    if (handleCancel(overwrite)) {
      clearLastLines(5);
      return;
    }
    if (!overwrite) return;

    // Hapus dulu sebelum create ulang
    try {
      fs.unlinkSync(resolvedPath);
    } catch (err) {
      console.log(color.red('Error deleting existing file:') + ' ' + err.message);
      return;
    }
  }

  // ── 5. Auto-create parent directory ───────────────────────────────────────
  const parentDir = isDir ? resolvedPath : path.dirname(resolvedPath);
  if (!pathExists(parentDir)) {
    try {
      fs.mkdirSync(parentDir, { recursive: true });
    } catch (err) {
      console.log(color.red('Error creating parent directory:') + ' ' + err.message);
      return;
    }
  }

  // ── 6. Create ──────────────────────────────────────────────────────────────
  try {
    if (isDir) {
      await withSpinner(`Creating folder ${color.cyan(resolvedPath)}...`, async () => {
        fs.mkdirSync(resolvedPath, { recursive: true });
      });
    } else {
      await withSpinner(`Creating file ${color.cyan(resolvedPath)}...`, async () => {
        fs.writeFileSync(resolvedPath, '', 'utf-8');
      });
    }
  } catch (err) {
    console.log(color.red(`Error creating ${typeLabel}:`) + ' ' + err.message);
    return;
  }

  // ── 7. Post-create ─────────────────────────────────────────────────────────
  if (!isDir) {
    const openFile = await confirmAction('Open file with micro?');
    if (handleCancel(openFile)) {
      clearLastLines(5);
      return;
    }
    if (openFile) {
      await openInMicro(resolvedPath);
    }
  }

  // ── 8. Success message ─────────────────────────────────────────────────────
  console.log(color.green('Created:') + ' ' + resolvedPath);
}
