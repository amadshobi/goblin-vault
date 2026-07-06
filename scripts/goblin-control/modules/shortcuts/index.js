/**
 * Shortcuts Module — jalanin external tools (gh-blin, ocm, fe).
 *
 * Flow:
 * 1. Menu pilih tool
 * 2. Cek apakah tool exists
 * 3. Kalo ada: jalanin via execCommandLive (real-time terminal)
 * 4. Kalo gak ada: tampilkan error
 * 5. Loop — setelah tool exit, balik ke menu
 */

import { p, color } from '../../utils/constants.js';
import { GH_BLIN_PATH, OCM_PATH, FE_PATH } from '../../utils/constants.js';
import { pathExists } from '../../utils/fs.js';
import { execCommandLive } from '../../utils/exec.js';
import { handleCancel, clearLastLines } from '../../utils/prompts.js';

export async function main() {
  while (true) {
    const choice = await p.select({
      message: 'Shortcuts — pilih tool:',
      options: [
        { value: 'gh-blin', label: 'gh-blin', hint: 'GitHub TUI' },
        { value: 'ocm',     label: 'ocm',     hint: 'opencode cfg' },
        { value: 'fe',      label: 'fe',      hint: 'file fzf' },
        { value: 'back',    label: '← Back to main menu' },
      ],
    });

    if (p.isCancel(choice) || choice === 'back') {
      if (p.isCancel(choice)) clearLastLines(7);
      break;
    }

    // Determine tool path
    let toolPath;
    let toolLabel;

    switch (choice) {
      case 'gh-blin':
        toolPath = GH_BLIN_PATH;
        toolLabel = 'gh-blin';
        break;
      case 'ocm':
        toolPath = OCM_PATH;
        toolLabel = 'ocm';
        break;
      case 'fe':
        toolPath = FE_PATH;
        toolLabel = 'fe';
        break;
      default:
        continue;
    }

    // Cek tool existence
    if (!pathExists(toolPath)) {
      console.log(
        color.red('Tool not found at:') + ' ' + color.cyan(toolPath)
      );
      console.log(
        color.dim(
          'Make sure the tool is installed and accessible. Check SCRIPTS_DIR in constants.js.'
        )
      );
      continue;
    }

    // Jalanin tool dengan output real-time
    console.log(color.dim(`\nLaunching ${toolLabel}...`));
    console.log(color.dim('(Press Ctrl+C or exit the tool to return)\n'));

    const exitCode = await execCommandLive(toolPath);

    if (exitCode !== 0) {
      console.log(
        color.yellow(`\n${toolLabel} exited with code ${exitCode}`)
      );
    } else {
      console.log(color.dim(`\n${toolLabel} closed.`));
    }
  }
}
