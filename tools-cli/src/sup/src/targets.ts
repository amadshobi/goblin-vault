/**
 * sup — Definisi target package manager.
 *
 * Setiap target = 1 modul updater yang:
 * - punya `id` unik (untuk dispatch).
 * - punya `label` + `hint` (untuk UI Clack p.multiselect).
 * - punya `detect()` -> Promise<boolean>  apakah PM tersedia di sistem.
 * - punya `scan()` -> Promise<OutdatedInfo | null>
 *       info outdated atau null.
 *       Bisa berisi `items?: OutdatedItem[]` untuk granular per-package
 *       (mis. tiap paket npm/pip outdated punya entry sendiri dengan id
 *       ber-prefix target id, contoh: "npm:opencode", "pip:requests").
 * - punya `update(selectedIds?: string[])` -> Promise<UpdateOutcome>
 *       opsional menerima daftar id item pilihan user. Untuk target
 *       non-granular, argumen ini bisa diabaikan dan semua di-update.
 *
 * Invariant: kalau `detect()` false, scan/update tidak dipanggil.
 */

import color from "picocolors";

import { exec, execLive, hasCommand } from "./exec";

/**
 * Satu item package/PM yang bisa di-update secara individual.
 *
 * Konvensi id:
 * - Untuk target non-granular (APT, SNAP, Brew, Bun, dsb) -> id = target.id
 *   dan hanya ada satu item utama (atau nol ketika tak ada outdated).
 * - Untuk target granular (NPM, PIP) -> id berbentuk `${target.id}:${pkgName}`
 *   contoh "npm:opencode", "pip:requests".
 *
 * Field `value` dipakai oleh clack `p.multiselect` (`initialValues` meng-
 * ekspektasikan daftar `value`). Kita samakan dengan `id` supaya caller
 * tidak perlu mapping tambahan.
 */
export interface OutdatedItem {
  /** Identifier unik item — dipake sebagai nilai clack multiselect. */
  id: string;
  /** Label untuk UI (sudah termasuk emoji kategori bila perlu). */
  label: string;
  /** Hint kecil untuk UI clack. */
  hint?: string;
}

/**
 * Info hasil scanning.
 *
 * Kalau `items` terisi, UI menampilkan granular per-package picker; kalau
 * tidak, UI fallback ke label utama (mode lama).
 */
export interface OutdatedInfo {
  /** Identifier target ini (misal "apt", "npm"). */
  id: string;
  /** Label untuk UI. */
  label: string;
  /** Hint kecil untuk UI. */
  hint: string;
  /** Jumlah package yang outdated (kalau ada). */
  count?: number;
  /**
   * Opsional: daftar granular per-package / per-target yang outdated.
   * Kalau ada, UI multiselect akan menampilkan entry per-item ini.
   * Kalau absent/undefined, UI fallback menampilkan satu entry dengan
   * `id` sebagai value.
   */
  items?: OutdatedItem[];
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
 *
 * `update(selectedIds?, opts?)` menerima:
 * - `selectedIds?` : optional list id item yang dipilih user.
 *   Untuk target non-granular, default-nya `undefined` = update semua.
 *   Untuk target granular (npm/pip), caller akan mengirim subset id
 *   (`npm:opencode`, `npm:kilocode`, ...) yang akan dipakai target untuk
 *   memfilter paket yang di-install.
 * - `opts?.verbose` (default false) : kalau true, execLive pakai
 *   `inheritStdout:true` sehingga output command streaming live ke
 *   terminal. Caller (runner) sudah stop spinner clack SEBELUM
 *   invoke update() untuk menghindari tabrakan renderer.
 */
export interface UpdaterTarget {
  id: string;
  label: string;
  hint: string;
  detect: () => Promise<boolean>;
  scan: () => Promise<OutdatedInfo | null>;
  update: (
    selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => Promise<UpdateOutcome>;
}

/**
 * Helper kecil untuk resolve `inheritStdout` flag pada execLive().
 *
 * - verbose=true   -> inherit = true  (live streaming ke terminal).
 * - verbose=false  -> inherit = false (mode quiet, spinner tetap jalan).
 *
 * Ditulis sebagai helper supaya setiap target tidak harus menulis
 * ternary yang sama berulang-ulang.
 */
function liveStdout(verbose: boolean | undefined): { inheritStdout: boolean } {
  return { inheritStdout: verbose === true };
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
      // APT non-granular (satu blok paket di-upgrade bareng).
      // Tampilkan satu entry utama dengan id target.
      items: [
        {
          id: apt.id,
          label: `${apt.label} (${count} upgradable)`,
          hint: apt.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    // APT bersifat all-or-nothing — `selectedIds` diabaikan untuk target
    // ini (interface signature diseragamkan supaya caller tak perlu
    // dispatch by-target).
    void _selectedIds;
    const start = Date.now();
    const stdout = liveStdout(opts?.verbose);
    const cmd1 = await withSudo(["apt", "update"]);
    const cmd2 = await withSudo(["apt", "upgrade", "-y"]);
    const cmd3 = await withSudo(["apt", "autoremove", "-y"]);
    const cmd4 = await withSudo(["apt", "autoclean", "-y"]);
    // Tahap "upgrade" adalah yang terpanjang & paling menarik untuk
    // dilihat -> hormati flag verbose. Tahap lain default quiet.
    const r1 = await execLive(cmd1, stdout);
    const r2 = await execLive(cmd2, stdout);
    const r3 = await execLive(cmd3, stdout);
    const r4 = await execLive(cmd4, stdout);
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
      items: [
        {
          id: snap.id,
          label: `${snap.label} (${count} upgradable)`,
          hint: snap.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    void _selectedIds;
    const start = Date.now();
    const cmd = await withSudo(["snap", "refresh"]);
    // Snap refresh = satu command panjang; hormati verbose.
    const r = await execLive(cmd, liveStdout(opts?.verbose));
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
    if (!(await hasCommand("bun"))) return null;
    const r = await exec(["bun", "upgrade"], { timeoutMs: 15000 });
    const output = `${r.stdout}\n${r.stderr}`;
    // Jika output menyatakan sudah di versi terbaru -> tidak ada update (return null)
    if (output.includes("already on the latest version")) return null;
    return {
      id: bun.id,
      label: bun.label,
      hint: bun.hint,
      items: [
        {
          id: bun.id,
          label: bun.label,
          hint: bun.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    void _selectedIds;
    const start = Date.now();
    const r = await execLive(["bun", "upgrade"], liveStdout(opts?.verbose));
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
    const r = await exec(["omp", "update"], { timeoutMs: 15000 });
    const output = `${r.stdout}\n${r.stderr}`;
    if (output.includes("Already up to date")) return null;
    return {
      id: omp.id,
      label: omp.label,
      hint: omp.hint,
      items: [
        {
          id: omp.id,
          label: omp.label,
          hint: omp.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    void _selectedIds;
    const start = Date.now();
    // omp CLI tidak mendukung flag --yes/-y, jadi panggil langsung tanpa argumen.
    const r = await execLive(["omp", "update"], liveStdout(opts?.verbose));
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
    const r = await exec(["rustup", "check"], { timeoutMs: 20000 });
    const output = `${r.stdout}\n${r.stderr}`;
    // Jika tidak ada "Update available" -> return null
    if (!/update available/i.test(output)) return null;
    return {
      id: rustup.id,
      label: rustup.label,
      hint: rustup.hint,
      items: [
        {
          id: rustup.id,
          label: rustup.label,
          hint: rustup.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    void _selectedIds;
    const start = Date.now();
    const r = await execLive(["rustup", "update"], liveStdout(opts?.verbose));
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
      // Brew `upgrade` bersifat all-or-nothing (1 target = upgrade
      // seluruh outdated). Item tunggal mempertahankan UX yang sudah ada.
      items: [
        {
          id: brew.id,
          label: `${brew.label} (${count} outdated)`,
          hint: brew.hint,
        },
      ],
    };
  },
  update: async (
    _selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    void _selectedIds;
    const start = Date.now();
    const stdout = liveStdout(opts?.verbose);
    const r1 = await execLive(["brew", "update"], stdout);
    // brew upgrade adalah yang terpanjang dan informatif → hormati verbose.
    const r2 = await execLive(["brew", "upgrade"], stdout);
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
 *  TARGET: PIP3 (granular — per-package picker)                       *
 *                                                                    *
 *  `scan()` akan populate `items[]` dengan id ber-prefix             *
 *  `pip:<packageName>` sehingga UI clack multiselect bisa            *
 *  tampilkan satu entry per package (default ter-select semua).       *
 *  `update(selectedIds?)` melakukan filter id yang ber-prefix "pip:" *
 *  dan hanya me-reinstall subset itu.                                *
 * ------------------------------------------------------------------ */

/**
 * Parse `pip3 list --outdated --format=freeze` menjadi nama package saja.
 * Format tiap line: "package==version"
 */
function parsePipOutdatedFreeze(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((l) => l.split("==")[0].trim())
    .filter((l) => l.length > 0);
}

const pip: UpdaterTarget = {
  id: "pip",
  label: "🐍 Python: PIP",
  hint: "pip3 outdated packages",
  detect: () => hasCommand("pip3"),
  scan: async () => {
    if (!(await hasCommand("pip3"))) return null;
    const r = await exec(
      ["pip3", "list", "--outdated", "--format=freeze"],
      { timeoutMs: 30000 },
    );
    const names = parsePipOutdatedFreeze(r.stdout);
    if (names.length === 0) return null;
    return {
      id: pip.id,
      label: `${pip.label} (${names.length} packages outdated)`,
      hint: pip.hint,
      count: names.length,
      items: names.map((name) => ({
        id: `${pip.id}:${name}`,
        label: `${pip.label}: ${color.bold(name)}`,
        hint: "pip package",
      })),
    };
  },
  update: async (
    selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    const start = Date.now();
    const allPkgs = parsePipOutdatedFreeze(
      (await exec(["pip3", "list", "--outdated", "--format=freeze"], { timeoutMs: 30000 })).stdout,
    );
    // Filter subset kalau user un-select beberapa paket di UI.
    // Hanya terima id ber-prefix `pip:` (guard supaya caller yang salah
    // mengirim paket dari PM lain tidak bikin update salah target).
    const prefix = `${pip.id}:`;
    const pkgs =
      selectedIds && selectedIds.length > 0
        ? selectedIds
            .filter((id) => id.startsWith(prefix))
            .map((id) => id.slice(prefix.length))
        : allPkgs;
    if (pkgs.length === 0) {
      return {
        id: pip.id,
        label: pip.label,
        ok: true,
        message: "Tidak ada pip3 package yang dipilih / outdated",
        durationMs: Date.now() - start,
      };
    }
    const r = await execLive(
      ["pip3", "install", "-U", "--break-system-packages", "--user", ...pkgs],
      liveStdout(opts?.verbose),
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
 *  TARGET: NPM (global) — granular per-package picker                 *
 *                                                                    *
 *  `scan()` populate `items[]` dengan id ber-prefix `npm:<pkg>`,     *
 *  sehingga UI menampilkan satu entry per paket.                      *
 *  `update(selectedIds?)` melakukan filter id ber-prefix "npm:" dan *
 *  hanya install subset itu ke versi @latest.                         *
 * ------------------------------------------------------------------ */

/**
 * Baca output `npm outdated -g --json` -> array nama package.
 */
async function readNpmOutdated(): Promise<string[]> {
  const r = await exec(["npm", "outdated", "-g", "--json"], { timeoutMs: 30000 });
  const txt = r.stdout.trim();
  if (!txt || txt === "{}" || txt === "[]") return [];
  try {
    const parsed = JSON.parse(txt);
    return Object.keys(parsed);
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
    const names = await readNpmOutdated();
    if (names.length === 0) return null;
    return {
      id: npmGlobal.id,
      label: `${npmGlobal.label} (${names.length} outdated)`,
      hint: npmGlobal.hint,
      count: names.length,
      items: names.map((name) => ({
        id: `${npmGlobal.id}:${name}`,
        label: `${npmGlobal.label}: ${color.bold(name)}`,
        hint: "global npm package",
      })),
    };
  },
  update: async (
    selectedIds?: string[],
    opts?: { verbose?: boolean },
  ) => {
    const start = Date.now();
    const allPkgs = await readNpmOutdated();
    // Filter subset kalau user un-select beberapa paket di UI.
    // Hanya terima id ber-prefix `npm:` (guard supaya caller yang
    // salah kirim paket dari PM lain tidak bikin update salah target).
    const prefix = `${npmGlobal.id}:`;
    const pkgs =
      selectedIds && selectedIds.length > 0
        ? selectedIds
            .filter((id) => id.startsWith(prefix))
            .map((id) => id.slice(prefix.length))
        : allPkgs;
    if (pkgs.length === 0) {
      return {
        id: npmGlobal.id,
        label: npmGlobal.label,
        ok: true,
        message: "Tidak ada npm global package yang dipilih / outdated",
        durationMs: Date.now() - start,
      };
    }
    const r = await execLive(
      ["npm", "install", "-g", ...pkgs.map((n) => `${n}@latest`)],
      liveStdout(opts?.verbose),
    );
    return {
      id: npmGlobal.id,
      label: npmGlobal.label,
      ok: r.ok,
      message: r.ok
        ? `${pkgs.length} npm package(s) upgraded`
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
