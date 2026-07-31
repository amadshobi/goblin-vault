/**
 * sup — Definisi target package manager.
 *
 * Setiap target = 1 modul updater yang:
 * - punya `id` unik (untuk dispatch).
 * - punya `label` + `hint` (untuk UI Clack p.multiselect).
 * - punya `detect()` -> Promise<boolean>  apakah PM tersedia di sistem.
 * - punya `scan()`  -> Promise<OutdatedInfo | null>  info outdated atau null.
 * - punya `update(targets?)` -> Promise<UpdateOutcome>.
 *
 * Invariant: kalau `detect()` false, scan/update tidak dipanggil.
 */

import { exec, execLive, hasCommand } from "./exec";

/**
 * Info hasil scanning.
 */
export interface OutdatedInfo {
  /** Identifier target ini (misal "apt", "npm:typescript"). */
  id: string;
  /** Label untuk UI. */
  label: string;
  /** Hint kecil untuk UI. */
  hint: string;
  /** Jumlah package yang outdated (kalau ada). */
  count?: number;
}

/**
 * Outcome hasil update.
 */
export interface UpdateOutcome {
  id: string;
  label: string;
  ok: boolean;
  message: string;
  durationMs: number;
}

/**
 * Definisi 1 target package manager.
 */
export interface UpdaterTarget {
  id: string;
  label: string;
  hint: string;
  detect: () => Promise<boolean>;
  scan: () => Promise<OutdatedInfo | null>;
  update: () => Promise<UpdateOutcome>;
}

/* ------------------------------------------------------------------ *
 *  BANTUAN: tambah "sudo" di depan command kalau bukan root.          *
 *                                                                     *
 *  CATATAN INTERAKSI DENGAN `execLive`:                              *
 *  - Kalau baris ini menghasilkan array yang di-head `sudo`,         *
 *    wrapper `execLive()` di `exec.ts` akan mendeteksinya dan       *
 *    otomatis menyuntikkan flag `-S` lalu mengirim password via      *
 *    stdin (lihat `sudo.ts`). Hal ini mencegah tabrakan TTY antara   *
 *    prompt `sudo` bawaan dengan UI Clack spinner/password prompt.  *
 * ------------------------------------------------------------------ */

async function isRoot(): Promise<boolean> {
  const r = await exec(["id", "-u"]);
  return r.stdout.trim() === "0";
}

async function withSudo(cmdParts: string[]): Promise<string[]> {
  if (await isRoot()) return cmdParts;
  return ["sudo", ...cmdParts];
}

/* ------------------------------------------------------------------ *
 *  TARGET: APT (Debian/Ubuntu package manager)                        *
 * ------------------------------------------------------------------ */

const apt: UpdaterTarget = {
  id: "apt",
  label: "📦 System: APT",
  hint: "Debian/Ubuntu system packages",
  detect: () => hasCommand("apt"),
  scan: async () => {
    const r = await exec(["apt", "list", "--upgradable"], { timeoutMs: 15000 });
    const lines = r.stdout.split("\n").slice(1).filter((l) => l.trim().length > 0);
    const count = lines.length;
    if (count === 0) return null;
    return {
      id: apt.id,
      label: `${apt.label} (${count} packages upgradable)`,
      hint: apt.hint,
      count,
    };
  },
  update: async () => {
    const start = Date.now();
    const cmd1 = await withSudo(["apt", "update"]);
    const cmd2 = await withSudo(["apt", "upgrade", "-y"]);
    const cmd3 = await withSudo(["apt", "autoremove", "-y"]);
    const cmd4 = await withSudo(["apt", "autoclean", "-y"]);
    const r1 = await execLive(cmd1, { inheritStdout: false });
    const r2 = await execLive(cmd2);
    const r3 = await execLive(cmd3, { inheritStdout: false });
    const r4 = await execLive(cmd4, { inheritStdout: false });
    const ok = r1.ok && r2.ok && r3.ok && r4.ok;
    return {
      id: apt.id,
      label: apt.label,
      ok,
      message: ok ? "APT up to date" : `Gagal di salah satu tahap (exit ${r2.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: SNAP                                                        *
 * ------------------------------------------------------------------ */

const snap: UpdaterTarget = {
  id: "snap",
  label: "📦 System: SNAP",
  hint: "Snap universal packages",
  detect: () => hasCommand("snap"),
  scan: async () => {
    const r = await exec(["snap", "refresh", "--list"], { timeoutMs: 15000 });
    const lines = r.stdout.split("\n").slice(1).filter((l) => l.trim().length > 0);
    const count = lines.length;
    if (count === 0) return null;
    return {
      id: snap.id,
      label: `${snap.label} (${count} packages upgradable)`,
      hint: snap.hint,
      count,
    };
  },
  update: async () => {
    const start = Date.now();
    const cmd = await withSudo(["snap", "refresh"]);
    const r = await execLive(cmd);
    return {
      id: snap.id,
      label: snap.label,
      ok: r.ok,
      message: r.ok ? "SNAP refreshed" : `SNAP gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: BUN (runtime + package manager)                            *
 * ------------------------------------------------------------------ */

const bun: UpdaterTarget = {
  id: "bun",
  label: "🍞 Runtime: Bun",
  hint: "bun upgrade",
  detect: () => hasCommand("bun"),
  scan: async () => {
    // Bun tidak punya "outdated list" yang ringan, jadi default tampilkan opsi upgrade selalu
    if (!(await hasCommand("bun"))) return null;
    return {
      id: bun.id,
      label: bun.label,
      hint: bun.hint,
    };
  },
  update: async () => {
    const start = Date.now();
    const r = await execLive(["bun", "upgrade"]);
    return {
      id: bun.id,
      label: bun.label,
      ok: r.ok,
      message: r.ok ? "Bun upgraded" : `Bun upgrade gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: OMP (Oh My Pi)                                             *
 * ------------------------------------------------------------------ */

const omp: UpdaterTarget = {
  id: "omp",
  label: "🧙 CLI: Oh My Pi (omp)",
  hint: "omp update",
  detect: () => hasCommand("omp"),
  scan: async () => {
    if (!(await hasCommand("omp"))) return null;
    return {
      id: omp.id,
      label: omp.label,
      hint: omp.hint,
    };
  },
  update: async () => {
    const start = Date.now();
    // omp mungkin exit non-zero pada update yang sebenarnya sukses — coba 2 mode
    const r1 = await execLive(["omp", "update", "--yes"], { inheritStdout: false });
    const r = r1.ok ? r1 : await execLive(["omp", "update"], { inheritStdout: false });
    return {
      id: omp.id,
      label: omp.label,
      ok: r.ok,
      message: r.ok ? "Oh My Pi updated" : `omp update gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: RUSTUP                                                     *
 * ------------------------------------------------------------------ */

const rustup: UpdaterTarget = {
  id: "rustup",
  label: "🦀 Runtime: Rust Toolchain",
  hint: "rustup update",
  detect: () => hasCommand("rustup"),
  scan: async () => {
    if (!(await hasCommand("rustup"))) return null;
    return {
      id: rustup.id,
      label: rustup.label,
      hint: rustup.hint,
    };
  },
  update: async () => {
    const start = Date.now();
    const r = await execLive(["rustup", "update"]);
    return {
      id: rustup.id,
      label: rustup.label,
      ok: r.ok,
      message: r.ok ? "Rust toolchain updated" : `rustup update gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: HOMEBREW                                                   *
 * ------------------------------------------------------------------ */

const brew: UpdaterTarget = {
  id: "brew",
  label: "🍺 Package: Homebrew",
  hint: "macOS/Linuxbrew packages",
  detect: () => hasCommand("brew"),
  scan: async () => {
    if (!(await hasCommand("brew"))) return null;
    const r = await exec(["brew", "outdated"], { timeoutMs: 30000 });
    const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
    const count = lines.length;
    if (count === 0) return null;
    return {
      id: brew.id,
      label: `${brew.label} (${count} outdated)`,
      hint: brew.hint,
      count,
    };
  },
  update: async () => {
    const start = Date.now();
    const r1 = await execLive(["brew", "update"], { inheritStdout: false });
    const r2 = await execLive(["brew", "upgrade"]);
    return {
      id: brew.id,
      label: brew.label,
      ok: r1.ok && r2.ok,
      message: r1.ok && r2.ok ? "Homebrew refreshed" : `brew gagal (update=${r1.exitCode}, upgrade=${r2.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: PIP3                                                       *
 * ------------------------------------------------------------------ */

const pip: UpdaterTarget = {
  id: "pip",
  label: "🐍 Python: PIP",
  hint: "pip3 outdated packages",
  detect: () => hasCommand("pip3"),
  scan: async () => {
    if (!(await hasCommand("pip3"))) return null;
    const r = await exec(
      ["pip3", "list", "--outdated", "--format=columns"],
      { timeoutMs: 30000 },
    );
    const lines = r.stdout.split("\n").slice(2).filter((l) => l.trim().length > 0);
    const count = lines.length;
    if (count === 0) return null;
    return {
      id: pip.id,
      label: `${pip.label} (${count} packages outdated)`,
      hint: pip.hint,
      count,
    };
  },
  update: async () => {
    const start = Date.now();
    const list = await exec(
      ["pip3", "list", "--outdated", "--format=freeze"],
      { timeoutMs: 30000 },
    );
    const pkgs = list.stdout
      .split("\n")
      .map((l) => l.split("==")[0].trim())
      .filter((l) => l.length > 0);
    if (pkgs.length === 0) {
      return {
        id: pip.id,
        label: pip.label,
        ok: true,
        message: "Tidak ada pip3 package outdated",
        durationMs: Date.now() - start,
      };
    }
    const r = await execLive(
      ["pip3", "install", "-U", "--break-system-packages", "--user", ...pkgs],
      { inheritStdout: false },
    );
    return {
      id: pip.id,
      label: pip.label,
      ok: r.ok,
      message: r.ok
        ? `${pkgs.length} pip package(s) upgraded`
        : `pip upgrade gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  TARGET: NPM (global) — 1 entry tapi ekspansi per package           *
 * ------------------------------------------------------------------ */

interface NpmOutdatedEntry {
  name: string;
}

async function readNpmOutdated(): Promise<NpmOutdatedEntry[]> {
  const r = await exec(["npm", "outdated", "-g", "--json"], { timeoutMs: 30000 });
  if (!r.stdout.trim() || r.stdout.trim() === "{}") return [];
  try {
    const parsed = JSON.parse(r.stdout);
    return Object.keys(parsed).map((name) => ({ name }));
  } catch {
    return [];
  }
}

const npmGlobal: UpdaterTarget = {
  id: "npm",
  label: "📦 NPM Global",
  hint: "global npm packages",
  detect: () => hasCommand("npm"),
  scan: async () => {
    const entries = await readNpmOutdated();
    if (entries.length === 0) return null;
    return {
      id: npmGlobal.id,
      label: `${npmGlobal.label} (${entries.length} outdated)`,
      hint: npmGlobal.hint,
      count: entries.length,
    };
  },
  update: async () => {
    const start = Date.now();
    const entries = await readNpmOutdated();
    if (entries.length === 0) {
      return {
        id: npmGlobal.id,
        label: npmGlobal.label,
        ok: true,
        message: "NPM global up to date",
        durationMs: Date.now() - start,
      };
    }
    const names = entries.map((e) => e.name);
    const r = await execLive(
      ["npm", "install", "-g", ...names.map((n) => `${n}@latest`)],
      { inheritStdout: false },
    );
    return {
      id: npmGlobal.id,
      label: npmGlobal.label,
      ok: r.ok,
      message: r.ok
        ? `${names.length} npm package(s) upgraded`
        : `npm install -g gagal (exit ${r.exitCode})`,
      durationMs: Date.now() - start,
    };
  },
};

/* ------------------------------------------------------------------ *
 *  EXPORT                                                              *
 * ------------------------------------------------------------------ */

/**
 * Daftar semua target yang tersedia, diurutkan sesuai spec.
 */
export const TARGETS: readonly UpdaterTarget[] = [
  apt,
  snap,
  bun,
  omp,
  rustup,
  brew,
  pip,
  npmGlobal,
] as const;

/**
 * Lookup target by id (case-insensitive).
 *
 * @param id - id target, misal "apt", "npm", "all".
 * @returns UpdaterTarget atau undefined.
 */
export function findTarget(id: string): UpdaterTarget | undefined {
  const lower = id.toLowerCase();
  return TARGETS.find((t) => t.id === lower);
}
