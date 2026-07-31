# Changelog — `sup`

> Riwayat lengkap perubahan untuk tool **`sup`** (Smart Universal Package Updater).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [v1.1.0] - Feature Release

### Added
- **Granular Package Picker UI (Default ALL Selected)**: Sub-package dari NPM global dan Python PIP3 kini diekspansi secara individu di UI Multiselect (`npm:opencode`, `pip:requests`, dll) dengan status default ter-select (`initialValues`).
- **Verbose Streaming Mode (`-v, --verbose`)**: Menambahkan flag `-v, --verbose` untuk menampilkan output live-streaming dari package manager (mematikan spinner tenang untuk kebutuhan debugging).
- **Dynamic Auto-Detect Version**: `banner.ts` dan `help.ts` kini mendeteksi versi secara dinamis dari `package.json` (`pkg.version`) untuk mencegah mis-versi di masa depan.
- **Precision Scanner Filters**: Scanner `rustup`, `bun`, dan `omp` kini melakukan pre-check status aktual sehingga tidak akan lagi muncul di menu jika sudah up-to-date.

## [v1.0.1] - Bug Fixes & UX Polish

### Fixed
- **Sudo Loop Fix (`sup all`)**: Memperbaiki issue hang/looping pada `sup all` ketika mendeteksi target yang memerlukan akses root (`apt`/`snap`). Sekarang password sudo di-request via `p.password()` secara proactive setelah scanning dan disimpan di memori sebelum update loop dimulai.
- **`omp` Update Flag Fix**: Menghapus flag `--yes` / `-y` dari pemanggilan update `omp` di `targets.ts` karena CLI Oh My Pi tidak mendukung flag `--yes`. Sekarang menggunakan `omp update` murni.
- **UI/UX Polish**: Menampilkan durasi eksekusi pada status sukses `(X.Xs)`, Failure Box Note rincian target gagal di outro, Goblin Roast Hint pada Level 2 help jika sub-command tidak dikenal, serta log transparansi pemberihan password sudo dari memori.

## [v1.0.0] - TypeScript Migration

### Added
- **`sup` TypeScript Migration**: Smart Universal Package Updater yang sebelumnya adalah bash script `scripts/shell/sup.sh` dimigrasikan menjadi tool TypeScript modern di `tools-cli/src/sup/`.
  - Entry point: `tools-cli/src/sup/src/index.ts`; wrapper executable: `tools-cli/bin/sup` (chmod +x, auto-`bun install` jika dep belum ada).
  - Pakai `@clack/prompts` (spinner, multiselect, intro/outro) + `picocolors`, sejajar style dengan `ocm` dan `gh-blin`.
  - ASCII Banner "SUP" putih (`\033[1;37m`) sesuai Standard Banner ASCII Header.
  - Dual-Level Help: `sup --help` (Level 1) & `sup <target> --help` / `sup help <target>` (Level 2).
  - Sub-command direct: `sup apt`, `sup npm`, `sup bun`, `sup omp`, `sup rustup`, `sup brew`, `sup pip`, `sup snap`, `sup all` — skip UI, langsung scan+update.
  - Mode `sup all`: scan paralel semua target → eksekusi sequential (menghindari lock conflict `apt`/`dpkg`).
  - Non-TTY Guard (`process.stdout.isTTY === false`): otomatis fallback ke text logger statis & mode auto — usable di pipeline/CI.
  - Goblin Roast Hint + pesan `🔥 [sup fatal]` untuk error reporting yang ramah terminal.
  - TypeScript strict mode + `bun-types` untuk API runtime yang aman.

### Removed
- **`scripts/shell/sup.sh`**: File bash lawas diarsipkan ke `docs/history/sup-migration/sup.sh.v3-bash-legacy` (bukan dihapus total supaya histori implementasi tetap terjaga). Implementasi aktif pindah ke `tools-cli/src/sup/`.
