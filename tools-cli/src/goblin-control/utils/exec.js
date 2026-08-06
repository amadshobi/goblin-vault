import { exec, spawn } from 'child_process';

/**
 * execCommand — jalanin command via shell, return captured output.
 * Cocok buat command yang outputnya pendek (git status, ls, etc).
 *
 * @param {string} cmd
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function execCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({
        stdout: (stdout || '').toString(),
        stderr: (stderr || '').toString(),
        code: error ? (error.code ?? 1) : 0,
      });
    });
  });
}

/**
 * execCommandLive — jalanin command via spawn dengan output real-time ke terminal.
 * Cocok buat command interaktif (gb, ocm, fe, dll).
 *
 * @param {string} cmd
 * @returns {Promise<number>} — exit code
 */
export function execCommandLive(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, [], {
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => resolve(code ?? 0));
    proc.on('error', () => resolve(1));
  });
}
