/**
 * sup — Dual-Level Help formatter.
 *
 * Sesuai spec di AGENTS.md (CLI UX & Dual-Level Help Standard):
 * - Level 1 (`sup --help`): makro overview + hint ke Level 2
 * - Level 2 (`sup <command> --help`): manual mendalam per-target
 */

import color from "picocolors";

/**
 * Level 1: Overview global.
 */
export function showLevel1Help(): void {
  console.log(`
${color.bold(color.white("sup"))} ${color.dim("— Smart Universal Package Updater")} ${color.dim("v1.0.0")}

${color.yellow("Deskripsi:")}
  sup adalah tool parallel updater untuk berbagai package manager (APT, SNAP,
  Bun, OMP, Rustup, Brew, PIP, NPM global) dengan UI Clack TUI interaktif.

${color.yellow("Penggunaan:")}
  ${color.cyan("sup")}                      ${color.dim("— Mode interaktif (scanning + multi-select)")}
  ${color.cyan("sup <target>")}             ${color.dim("— Skip UI, jalankan langsung (apt|brew|...)")}
  ${color.cyan("sup all")}                  ${color.dim("— Update semua PM yang terdeteksi outdated")}
  ${color.cyan("sup -h | --help | help")}   ${color.dim("— Tampilkan bantuan ini")}

${color.yellow("Daftar Sub-Command & Target (Level 2 Help: sup <command> --help):")}
  ${color.green("apt")}        APT system packages (Debian/Ubuntu)
  ${color.green("snap")}       SNAP universal packages
  ${color.green("bun")}        Bun runtime upgrade
  ${color.green("omp")}        Oh My Pi (omp update)
  ${color.green("rustup")}     Rust toolchain update
  ${color.green("brew")}       Homebrew packages
  ${color.green("pip")}        Python PIP3 packages
  ${color.green("npm")}        NPM global packages
  ${color.green("all")}        Update semua target yang outdated (non-interactive)

${color.yellow("Global Flags:")}
  ${color.cyan("-y, --yes, --all")}    Langsung jalankan semua target (skip interaktif)
  ${color.cyan("-h, --help")}          Tampilkan bantuan ini
`);
}

/**
 * Level 2: Detail per-target.
 *
 * @param target - id target, misal "apt", "snap", "all".
 */
export function showLevel2Help(target: string): void {
  const lower = target.toLowerCase();
  if (lower === "all") {
    console.log(`
${color.bold(color.white("sup all"))} ${color.dim("— Update semua PM yang terdeteksi outdated")}

${color.yellow("Deskripsi:")}
  Mode non-interaktif yang akan scan seluruh target, lalu langsung jalankan
  update untuk yang outdated — tanpa konfirmasi user.

${color.yellow("Penggunaan:")}
  ${color.cyan("sup all [--yes|-y]")}

${color.yellow("Contoh:")}
  ${color.green("sup all")}                   Scan + update semua
  ${color.green("sup all -y")}                Alias --yes
`);
    return;
  }

  const descriptions: Record<string, [string, string, string[]]> = {
    apt: [
      "APT system packages",
      "Melakukan: sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y && sudo apt autoclean -y",
      [
        "Password sudo diminta via Clack p.password() sekali di awal sesi",
        "Output live-streaming ke terminal",
        "Hanya muncul di menu kalau ada package upgradable",
      ],
    ],
    snap: [
      "SNAP universal packages",
      "Melakukan: sudo snap refresh",
      [
        "Password sudo dikirim via stdin (sudo -S) — tidak konflik dengan UI Clack",
        "Streaming output ke terminal",
      ],
    ],
    bun: [
      "Bun runtime upgrade",
      "Melakukan: bun upgrade",
      ["Tidak ada metrik outdated — opsi selalu tersedia kalau bun terinstall"],
    ],
    omp: [
      "Oh My Pi (omp) upgrade",
      "Melakukan: omp update --yes (fallback omp update)",
      ["omp mungkin exit non-zero padahal sukses — dilihat via fallback"],
    ],
    rustup: [
      "Rust toolchain update",
      "Melakukan: rustup update",
      ["Stable + active toolchain diupdate"],
    ],
    brew: [
      "Homebrew update + upgrade",
      "Melakukan: brew update && brew upgrade",
      ["MacOS/Linuxbrew"],
    ],
    pip: [
      "Python PIP3 outdated packages",
      "Mengambil daftar `pip3 list --outdated`, lalu install -U per package",
      [
        "Menggunakan flag --break-system-packages --user",
        "Cocok untuk environment single-user",
      ],
    ],
    npm: [
      "NPM Global packages",
      "Membaca `npm outdated -g --json`, lalu install -g per package ke versi @latest",
      ["Granular: setiap package di-upgrade satu per satu"],
    ],
  };

  const entry = descriptions[lower];
  if (!entry) {
    console.log(color.red(`\n❌ sup: tidak ada sub-command "${target}" yang dikenal.\n`));
    console.log("Gunakan 'sup --help' untuk daftar lengkap.");
    return;
  }

  const [label, command, notes] = entry;
  console.log(`
${color.bold(color.white(`sup ${lower}`))} ${color.dim("— " + label)}

${color.yellow("Perintah:")}
  ${color.cyan(command)}

${color.yellow("Catatan:")}
${notes.map((n) => `  - ${n}`).join("\n")}

${color.yellow("Penggunaan:")}
  ${color.cyan(`sup ${lower}`)}             Run scan + update langsung
  ${color.cyan(`sup ${lower} --help`)}      Tampilkan halaman bantuan ini
`);
}
