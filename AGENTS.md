# AGENTS.md

Panduan ini wajib dibaca dan diikuti oleh semua AI agent, subagent, dan kontributor
yang beroperasi di dalam repositori **Goblin Vault**. Tujuannya: menjaga agar setiap
perubahan konsisten, aman, dan selaras dengan arah arsitektur vault.

---

## Overview

**Goblin Vault** adalah repositori yang berisi alat-alat CLI, utilities, dan
konfigurasi untuk manajemen infrastruktur, pengembangan, dan automasi harian seorang
builder-goblin. Filosofi utamanya: mengikis friksi di terminal sedikit demi sedikit
hingga tumpukan script acak ini berevolusi menjadi sebuah **Control Center** yang
sesungguhnya.

Repositori ini bukan sekadar kumpulan script — ini adalah pusat komando dan memori.
Oleh karena itu, setiap perubahan harus mempertahankan kestabilan sistem yang sudah
berjalan, bukan sekadar menambah fitur demi keren-kerenan.

---

## Struktur Repositori

```
goblin-vault/
├── tools-cli/              # Pusat persenjataan CLI
│   ├── bin/                # Executable binaries/wrappers (fex, gb, gn, sup, zf)
│   └── src/                # Source code mentah aplikasi CLI
│       ├── fex/            # File Explorer (Go + Cobra + FZF)
│       ├── gb/             # GitHub Assistant TUI (Node.js + Clack)
│       ├── gn/             # Goblin Nexus Core CLI (TypeScript + Bun)
│       ├── sup/            # Smart Package Updater (TypeScript + Bun)
│       └── zf/             # Zoxide & Tmux Navigation (Shell)
├── configs/                # Master configuration templates
│   ├── fex/                # Master fex runtime YAML config
│   ├── micro/              # Master micro editor setup
│   └── nvim/               # Master LazyVim setup (by amadshobi)
├── scripts/                # Utilities & automations
│   ├── check_syntax.js     # Linter & Security Engine (Bash, Go, JS, TS)
│   ├── doctor.js           # Health & Lego matrix diagnostic engine
│   ├── install.sh          # Modern All-in-One Installer & Remote Bootstrap
│   ├── install-hooks.sh    # Git hooks installer (pre-commit & pre-push)
│   ├── release.sh          # SemVer release engine & GitHub publisher
│   └── worktree.sh         # Git worktree manager
├── docs/                   # Rules, skills, update notes & history
│   ├── CHANGELOG/          # Changelog modular per-tool (sup.md, fex.md, gn.md, zf.md, gb.md)
│   ├── vhs/                # Automated Charmbracelet VHS tape scripts
│   ├── assets/             # SVGs and high-res rendered GIFs
│   ├── history/            # Riwayat implementasi harian (YYYY-MM-DD_nama.md)
│   └── rules/              # Aturan coding & operasional
├── .github/                # CI workflows + git hooks
│   ├── workflows/          # GitHub Actions (ci.yml)
│   └── hooks/              # pre-commit & pre-push hooks
├── AGENTS.md               # Panduan agent & kontributor
├── README.md               # Dokumentasi publik utama
└── CHANGELOG.md            # Master macro changelog (navigasi per-tool)
```

---

## Guideline Engineering

Empat prinsip ini BUKAN sekadar buzzword — ini aturan operasional yang harus terlihat
di hasil kerja:

- **Modularity** — Pisahkan concern. Satu file = satu tanggung jawab. Hindari file
  raksasa yang melakukan terlalu banyak hal.
- **Scalability** — Desain agar mudah ditambah, bukan ditulis ulang. Gunakan pola
  yang memungkinkan fitur baru menempel tanpa membedah yang lama.
- **Maintainability** — Kode harus bisa dibaca & di-debug oleh goblin lain 3 bulan
  ke depan. Hindari magic number, hindari side-effect tersembunyi.
- **Reusable** — Ekstrak utilitas umum ke modul yang bisa dipakai ulang. Jangan
  duplikasi logika yang sama di banyak tempat.

---

## Coding Standards

### Immutability (KRITIS)

SELALU buat objek baru, JANGAN mutasi objek yang sudah ada:

```
// SALAH: modify(original, field, value) -> mengubah original in-place
// BENAR: update(original, field, value) -> return copy baru dengan perubahan
```

Rationale: immutable data mencegah side-effect tersembunyi, mempermudah debug, dan
memungkinkan concurrency yang aman.

### File Organization

MANY SMALL FILES > FEW LARGE FILES:

- High cohesion, low coupling
- 200–400 baris typical, 800 maksimal
- Ekstrak utilities dari modul besar
- Organisasi berdasarkan fitur/domain, bukan tipe

### Error Handling

- Tangani error secara eksplisit di setiap level
- Pesan error ramah pengguna di kode yang berhadapan dengan UI
- Log konteks error detail di sisi server/tooling
- JANGAN telan error secara diam-diam (silent swallow)

### Input Validation

- Validasi semua input user sebelum diproses
- Gunakan schema-based validation bila tersedia
- Fail fast dengan pesan error yang jelas
- JANGAN percaya data eksternal (API response, user input, file content)

### CLI UX & Dual-Level Help Standard 🔴 MUST

Setiap alat CLI/TUI di repositori ini harus menjaga standar UX terminal:

- **Dual-Level Help System**:
  - **Level 1 Help (`<tool> --help`)**: Menyajikan daftar command utama secara makro, ringkas, dan menyertakan hint petunjuk Level 2.
  - **Level 2 Help (`<tool> <command> --help` atau `<tool> help <command>`)**: Menyajikan manual mendalam kontekstual per-subcommand (memuat deskripsi target, opsi flag, visual indicators, scoring/analytics, dan contoh perintah praktis).
- **Clean Output & Dynamic Spinners**: Gunakan visual status badges (`✅`, `⚠️`, `❌`), progress bar, dan spinner interaktif yang ramah terminal. Prompt interaktif harus dapat dibatalkan dengan aman.
- **Fail-Fast with Actionable Hints**: Jika terjadi error (misal gateway down/auth failed), tampilkan pesan error yang ramah beserta _Goblin Roast Hint_ perbaikan.

### Shell & Scripting

- Script di `scripts/` dan `bin/` harus POSIX-compliant bila memungkinkan, atau
  jelas bertarget Zsh/Bash (lihat badge di README — Shell: Zsh & Bash)
- Set `set -euo pipefail` di script yang berubah state
- Beri guard terhadap command yang destruktif (rm -rf, git reset --hard)

---

## Konvensi Repo

- **Bahasa dokumentasi**: Indonesia (utama), English untuk istilah teknis.
- **Changelog**: detail perubahan per-tool dicatat di `docs/CHANGELOG/<tool>.md`
  (e.g. `sup.md`, `fex.md`, `gn.md`); master `CHANGELOG.md` hanya memuat poin
  makro tingkat tinggi + navigasi ke changelog per-tool.
- **README**: selalu sync dengan struktur & fitur aktual — jangan biarkan melenceng.
- **Skills**: letakkan di `docs/skills/` (terdaftar di `kilo.jsonc`).
- **Branch/Worktree**: gunakan `scripts/worktree.sh` untuk isolasi pekerjaan.
- **Git hooks & CI**: repo dilengkapi `scripts/install-hooks.sh` (pre-commit + pre-push
  blocking) dan GitHub Actions `.github/workflows/ci.yml` (lint + build otomatis).
  - `pre-commit hook`: Menjalankan `scripts/check_syntax.js --staged` (hanya mengecek file yang di-`git add`).
  - `pre-push hook`: Menjalankan `scripts/check_syntax.js --full` (full repo scan menyeluruh untuk Bash, Go, JS, TS, dan executable permissions).
  - **Syntax Checker Modes (`scripts/check_syntax.js`)**:
    - `./scripts/check_syntax.js --staged` (`-s`): Fast scan khusus file yang di-stage (`git diff --cached`).
    - `./scripts/check_syntax.js --working` (`-w`): Scan file modified & file baru untracked di working directory.
    - `./scripts/check_syntax.js --full` (`-f`): Full repo scan menyeluruh untuk seluruh workspace.
- **Prosedur Release & Branch Sync (PENTING)**: Gunakan `./scripts/release.sh` untuk automated release (terintegrasi dengan health audit, git tagging, dan GitHub Release).
  - **Standard Workflow**: Semua perubahan wajib lahir di branch `dev` terlebih dahulu, kemudian lakukan Pull Request (PR) `dev -> main`. Eksekusi script release dilakukan setelah PR di-merge ke `main` atau langsung dari branch `main` lokal yang sudah ter-sync dengan remote.
  - **Single Source of Truth**: Dilarang keras meng-edit atau membuat commit langsung di branch `main`.
  - **Sync Back After Merge Rule (WAJIB)**: Setiap kali Pull Request (`dev -> main`) selesai di-merge ke branch `main`, maintainer/agent WAJIB segera menyinkronkan kembali branch `dev` dengan `main` terbaru menggunakan perintah:
    ```bash
    git checkout dev && git pull origin main && git push origin dev
    ```
    Tujuannya agar branch `dev` tidak tertinggal (_divergent_) dan menghindari terjadinya merge conflict yang menyebalkan di rilis berikutnya.
  - **Global Release**: `./scripts/release.sh vault <patch|minor|major>` untuk merilis versi global repo vault (memperbarui `VERSION`, commit changelog, membuat git tag `vX.Y.Z`, dan otomatis mempublikasikan **GitHub Release resmi** via `gh release create` dengan menyertakan release notes dari `CHANGELOG.md`).
  - **Modular Tool Release**: `./scripts/release.sh <tool_name> <patch|minor|major>` (e.g. `fex`, `gn`, `zf`, `sup`, `gb`) untuk memperbarui versi internal tool dan menulis changelog modular di `docs/CHANGELOG/<tool>.md`.

---

## Do / Don't

**Lakukan:**

- Cek `README.md`, `CHANGELOG.md`, `docs/CHANGELOG/`, dan struktur `tools-cli/` sebelum mengubah.
- Jalankan `scripts/doctor.js` & `scripts/check_syntax.js` sebelum anggap selesai.
- Pertahankan kompatibilitas dengan tools yang sudah dipakai BOSS harian.
- Tulis perubahan kecil, fokused, dan reversible.

**Jangan:**

- Mutasi objek existing (lihat Immutability).
- Commit secret / API key / credential ke repo.
- Ubah struktur `bin/` tanpa update README & PATH guidance.
- Tambah dependency besar tanpa alasan yang jelas & terukur.
- Biarkan error di-swallow diam-diam.

**Dilarang:**

- commit, add, push tanpa persetujuan
- cat and read secret, env, key

---

## Master Coding Style & Engineering Policies

### 1. Severity Level

- 🔴 **MUST** — Wajib mutlak, pelanggaran merupakan blocker merge & release.
- 🟠 **SHOULD** — Sangat disarankan, hanya boleh dilanggar jika ada alasan teknis yang kuat.
- 🟢 **MAY** — Preferensi/konvensi umum, ikuti jika tidak ada kendala.

### 2. Naming & Language Conventions 🟢 MAY

- **Go**: `camelCase` / exported `PascalCase`, file naming `snake_case.go`.
- **TypeScript / JavaScript**: `camelCase` fungsi & variabel, file naming `kebab-case.ts` (e.g. `smart-scanner.ts`).
- **Shell**: `snake_case` fungsi & variabel, file naming `snake_case.sh`.
- **Inline Comments**: Menjelaskan **WHY** (rasional arsitektur & batasan teknis), BUKAN mengulang WHAT. Bersih dari junk tags (`TODO`, `FIXME`, `HACK`).

### 3. Standard ASCII Banner Art 🟠 SHOULD

Setiap alat CLI/TUI utama di repositori ini menyajikan banner pembuka yang seragam:

- **Font Style**: Unicode Solid Block Font (`█`, `▀`, `▄`, `╔`, `╗`, `╚`, `╝`).
- **Layout & Spacing**: Sertakan margin 1 baris kosong (`echo ""`) di atas banner agar tidak menempel pada prompt terminal user (`shobixlinuxdev>`). Tulis nama tool dan versinya tepat di bawah banner ASCII.
- **Coloring**: Pure White (`\033[1;37m`) untuk tampilan ultra-clean & berkelas.

### 4. Pre-Change Quality Checklist

Sebelum menandai pekerjaan selesai:

- [ ] Perubahan kecil, modular, dan reversible.
- [ ] Objek/data immutable (tidak ada mutasi in-place pada input caller).
- [ ] Input boundary (argumen CLI, file path, JSON/YAML, env) tervalidasi dengan fail-fast.
- [ ] Error handling eksplisit dengan pesan informatif + _Goblin Roast Hint_.
- [ ] Shell script state-changing menyertakan `set -euo pipefail` dan argumen di-quote.
- [ ] Zero secret/API key/credential bocor ke codebase atau log.
- [ ] Dual-Level Help (`--help` dan `<command> --help`) tersedia untuk CLI tools.
- [ ] Changelog modular (`docs/CHANGELOG/<tool>.md`) dan master `CHANGELOG.md` disinkronkan.

---

> _Dibuat oleh Goblin, dirawat oleh Goblin, untuk kedamaian terminal Goblin. 🍻👹_
