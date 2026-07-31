/**
 * sup — Eksekusi command eksternal.
 *
 * Wrapper tipis di atas Bun.spawn / child_process supaya sisa kode sup
 * tidak perlu urus detail stream, stdout/stderr, atau exit-code.
 *
 * Prinsip dari AGENTS.md (Error Handling, External Commands):
 * - Tangani error eksplisit, jangan swallow.
 * - Pesan error harus konteks-nya jelas (command apa, args apa, exit code berapa).
 * - Untuk command destuktif (apt upgrade, snap refresh) biarkan caller
 *   yang decide apakah interactive confirm dibutuhkan.
 *
 * Mode Verbose (flag `-v` / `--verbose` di CLI):
 * - `verbose === true`  -> stdout di-INHERIT ke caller (streaming live).
 * - `verbose === false` (default) -> stdout di-PIPE dan ditelan.
 * - UI Clack spinner tetap aktif selama eksekusi non-verbose, sehingga
 *   user melihat spinner berputar tenang dari awal sampai akhir update.
 */

import { spawn } from "bun";
import { roastError } from "./logger";
import { getSudoPassword } from "./sudo";

/**
 * Hasil eksekusi command.
 */
export interface ExecResult {
  /** stdout content trimmed. */
  stdout: string;
  /** stderr content trimmed. */
  stderr: string;
  /** Exit code dari process (0 = sukses). */
  exitCode: number;
  /** Durasi total eksekusi dalam milliseconds. */
  durationMs: number;
  /** True jika exitCode == 0. */
  ok: boolean;
}

/**
 * Cek apakah sebuah command tersedia di PATH.
 *
 * @param bin - Nama binary / executable.
 * @returns Boolean true jika `command -v` sukses.
 */
export async function hasCommand(bin: string): Promise<boolean> {
  try {
    const proc = spawn({
      cmd: ["sh", "-c", `command -v ${JSON.stringify(bin)}`],
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Jalankan command dan tangkap stdout/stderr/exitCode.
 *
 * Untuk command yang butuh root (apt, snap), caller boleh prefiks
 * `sudo` jika diperlukan — wrapper ini tidak mengubah privileges.
 *
 * @param cmdParts - Array command + args, misal ["apt", "list", "--upgradable"].
 * @param opts - Opsional, {input, env, cwd, timeoutMs}.
 * @returns ExecResult.
 */
export async function exec(
  cmdParts: string[],
  opts: {
    input?: string;
    env?: Record<string, string>;
    cwd?: string;
    timeoutMs?: number;
  } = {},
): Promise<ExecResult> {
  const cmdStr = cmdParts.join(" ");
  const start = Date.now();
  try {
    const proc = spawn({
      cmd: cmdParts,
      stdin: opts.input !== undefined ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...(opts.env ?? {}) } as Record<string, string>,
      cwd: opts.cwd,
    });

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise =
      opts.timeoutMs !== undefined
        ? new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error(`Timeout setelah ${opts.timeoutMs}ms`)),
              opts.timeoutMs,
            );
          })
        : null;

    const settle = async () => {
      const [stdoutText, stderrText, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return {
        stdout: stdoutText,
        stderr: stderrText,
        exitCode: typeof exitCode === "number" ? exitCode : -1,
        durationMs: Date.now() - start,
        ok: exitCode === 0,
      } satisfies ExecResult;
    };

    const result = timeoutPromise
      ? await Promise.race([settle(), timeoutPromise.finally(() => clearTimeout(timeoutHandle!))])
      : await settle();

    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (err: any) {
    roastError(`Eksekusi gagal: ${cmdStr}`, err.message ?? String(err));
    return {
      stdout: "",
      stderr: err.message ?? String(err),
      exitCode: 124,
      durationMs: Date.now() - start,
      ok: false,
    };
  }
}

/**
 * Jalankan command dengan streaming stdout/stderr live ke terminal caller.
 *
 * Untuk command yang panjang (apt update, brew upgrade, rustup update)
 * supaya user lihat progress real.
 *
 * Strategi `sudo`:
 * - Kalau `cmdParts[0] === "sudo"` DAN kita punya password tersimpan,
 *   inject flag `-S` (read password from stdin) di posisi ke-2 lalu kirim
 *   password + newline ke `proc.stdin`, lalu tutup stream.
 * - Ini menghindari tabrakan antara prompt `sudo` bawaan dengan UI Clack
 *   yang sudah memakai TTY (menghindari error
 *   "sudo: A terminal is required to authenticate").
 * - Kalau password tidak tersedia (non-interaktif)→ fallback `stdin: "inherit"`
 *   supaya sudo tetap bisa prompt sendiri bila mungkin.
 *
 * Verbose / Quiet:
 * - `opts.inheritStdout === true` → `stdout:"inherit"` (live-stream).
 *   Caller (runner.ts) harus `spinner.stop()` SEBELUM invoke agar renderer
 *   clack tidak tabrakan dengan output terminal.
 * - `opts.inheritStdout === false` (default) → `stdout:"pipe"`, spinner
 *   boleh tetap berputar tenang selama proses berjalan.
 *
 * @param cmdParts - Command + args.
 * @param opts.inheritStdout - true = streaming live; false (default) = quiet.
 * @returns ExecResult.
 */
export async function execLive(
  cmdParts: string[],
  opts: { inheritStdout?: boolean } = {},
): Promise<ExecResult> {
  const start = Date.now();
  const password = getSudoPassword();
  const usesSudo = cmdParts[0] === "sudo";
  const hasStoredPassword = usesSudo && typeof password === "string" && password.length > 0;

  // Kalau pakai sudo + ada password → tambahkan flag -S agar sudo baca dari stdin,
  // BUKAN dari terminal UI. Ini step 1; pengiriman via stdin terjadi di bawah.
  const effectiveCmd =
    hasStoredPassword && cmdParts[1] !== "-S"
      ? ["sudo", "-S", ...cmdParts.slice(1)]
      : cmdParts;

  // Aturan verbose:
  // - inheritStdout === true   -> inherit stdout (live stream ke caller)
  // - inheritStdout === false  -> pipe stdout (UI spinner boleh tetap jalan)
  // - inheritStdout === undefined -> default = pipe (back-compat mode quiet)
  const stdoutMode = opts.inheritStdout === true ? "inherit" : "pipe";

  return await new Promise<ExecResult>((resolve) => {
    const proc = spawn({
      cmd: effectiveCmd,
      stdout: stdoutMode,
      stderr: "inherit",
      // Penting: kalau pakai sudo dengan password, kita MUST handle stdin
      // sendiri (pipe). Kalau tidak, fallback ke inherit.
      stdin: hasStoredPassword ? "pipe" : "inherit",
      env: process.env as Record<string, string>,
    });

    // Kirim password via stdin kalau pakai sudo + punya password.
    // Bun.WritableStream mengekspos .write(chunk) sebagai helper
    // (di luar spec WritableStream standard) — itulah cara paling ringkas
    // dan reliable untuk mengirim password ke `sudo -S`.
    if (hasStoredPassword) {
      try {
        const stdin = proc.stdin as unknown as {
          write?: (chunk: string | Uint8Array) => unknown;
        };
        if (stdin && typeof stdin.write === "function") {
          stdin.write(`${password}\n`);
        }
      } catch {
        // Ignore — process sudah exited / stream closed early.
      }
    }

    let captured = "";
    // Hanya tangkap kalau pipe (mode quiet). Kalau inherit, baca akan
    // hang karena tidak ada chunk yang masuk ke pipe.
    if (stdoutMode === "pipe") {
      new Response(proc.stdout).text().then((t) => (captured = t));
    }

    proc.exited.then((exitCode) => {
      resolve({
        stdout: captured,
        stderr: "",
        exitCode: typeof exitCode === "number" ? exitCode : -1,
        durationMs: Date.now() - start,
        ok: exitCode === 0,
      });
    });
  });
}
