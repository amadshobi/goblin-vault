# Goblin Vault 🙉

<p align="center">
  <img src="https://img.shields.io/badge/Goblin-Certified-magenta?style=for-the-badge&logo=opsgenie" alt="Goblin Certified" />
  <img src="https://img.shields.io/badge/Shell-Zsh%20%26%20Bash-blue?style=for-the-badge&logo=gnu-bash" alt="Shell" />
  <img src="https://img.shields.io/badge/Go-1.2x+-00ADD8?style=for-the-badge&logo=go" alt="Go" />
  <img src="https://img.shields.io/badge/Node-v22+-green?style=for-the-badge&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/Status-Under%20Evolution-orange?style=for-the-badge" alt="Status" />
</p>

---

> *"Ini bukan tentang nyari stars di GitHub. Bukan tentang keliatan keren di depan publik, apalagi sekadar latah ikut-ikutan tren AI yang lagi rame. Ini adalah catatan evolusi seorang **builder-goblin**. Setiap hari kami menemukan friksi di terminal, setiap hari kami terbentur hal-hal tidak efisien, dan setiap hari pula kami mengikis friksi tersebut—sedikit demi sedikit—hingga tumpukan script acak ini berevolusi menjadi sebuah **Control Center** yang sesungguhnya."*

---

## 🏗️ Struktur Vault

Repository ini adalah pusat komando dan memori dari seorang builder-goblin:

```
goblin-vault/
├── tools-cli/              # Pusat persenjataan CLI
│   ├── bin/                # Wrapper executable (ocm, gh-blin)
│   ├── src/                # Source code CLI
│   │   ├── fex/            # File Explorer (Go) — binary fex
│   │   │   ├── cmd/        # Command handlers (root.go, search_mode.go, tree_mode.go)
│   │   │   ├── docs/       # Dokumentasi fex
│   │   │   ├── helpers/    # Helper utilities (fzf-pick.sh, tmux-split.sh, dll)
│   │   │   └── internal/   # Internal packages (config, fzf, session, tmux, tree, ui, util)
│   │   ├── gh-blin/        # GitHub Assistant TUI (Node)
│   │   ├── goblin-control/ # Control center core (Node)
│   │   ├── notes/          # Notes utility (Node)
│   │   └── ocm/            # OpenCode Configurator TUI (Node)
│   ├── tests/              # Laboratorium uji coba (scratchpad)
│   └── docs/               # Dokumentasi & manual tiap tool
├── scripts/                # Utilities shell & js
│   ├── check_syntax.sh     # Linter/syntax check semua script
│   ├── doctor.sh           # Health & dependency checker
│   ├── install.sh          # Setup PATH & symlink config
│   ├── install-hooks.sh    # Install git hooks (pre-commit/pre-push)
│   └── worktree.sh         # Git worktree manager
├── configs/                # Konfigurasi editor & tooling
│   ├── micro/              # Source-of-truth config micro editor
│   └── nvim/               # LazyVim setup (init.lua, lua/, stylua.toml)
├── docs/                   # Rules, skills, update notes & history
│   ├── history/            # Riwayat implementasi harian (YYYY-MM-DD_nama.md)
│   ├── rules/              # Coding style & operational rules
│   └── update/             # Catatan rilis fitur (fex v4, full-foundation draft)
├── .github/                # CI workflows + git hooks
│   ├── workflows/          # GitHub Actions (ci.yml)
│   └── hooks/              # pre-commit & pre-push hooks
├── AGENTS.md               # Panduan agent & kontributor
├── README.md               # Dokumentasi publik utama
└── CHANGELOG.md            # Riwayat perubahan
```

---

## 🧪 Development / Kontribusi Lokal

Repo ini sudah punya **git hooks** + **CI GitHub Actions** untuk menjaga kualitas
kode sebelum masuk ke repo. Berikut cara kerjanya:

### Git Hooks (lokal)

Install hooks once:

```bash
bash scripts/install-hooks.sh
```

Hook yang aktif:
- **pre-commit**: jalankan `bash scripts/check_syntax.sh` + `bash scripts/doctor.sh` — blocking, commit ditolak jika ada error.
- **pre-push**: jalankan `bash scripts/doctor.sh` + build `fex` — blocking, push ditolak jika gagal.

### CI (remote)

Setiap PR/commit ke branch `dev` atau `main` memicu GitHub Actions:
- Lint + syntax check (`check_syntax.sh`)
- Build `fex` dari `tools-cli/src/fex/`

### Build `fex` (manual)

```bash
cd tools-cli/src/fex && go build -o ~/.local/bin/fex .
```

### Checklist sebelum PR

```bash
bash scripts/doctor.sh        # dependency & PATH check
bash scripts/check_syntax.sh  # lint Bash & JS
cd tools-cli/src/fex && go build -o ~/.local/bin/fex .
```

---

## 🛠️ Senjata Utama

### 1. 🔍 `fex` (File Explorer — Go)
Alat navigasi super cepat berbasis Go yang menggunakan `fzf` + `tmux` split.
Subcommand: `tree`, `search`, `create`, `editor`, `path`, `kill`, `backup micro`, `restore micro`.
State-machine internal dengan boundary `$HOME` (Esc/Ctrl-H untuk navigasi balik, Ctrl+R untuk Root).
Optimalisasi `-prune` agar tidak tersangkut di folder sampah (`node_modules`, `.git`, dll).

### 2. ⚙️ `ocm` (OpenCode Configurator)
Dashboard TUI interaktif berbasis Node.js (`@clack/prompts`) untuk mengelola
workspace, agent, session, dan credentials API Key AI tanpa edit file JSONC manual.
*Wrapper executable:* `tools-cli/bin/ocm`.

### 3. 🐙 `gh-blin` (GitHub Assistant TUI)
Asisten bermata satu untuk menangani pull-requests, issues, dan monitoring repo
GitHub langsung dari terminal. Berbasis Node.js.
*Wrapper executable:* `tools-cli/bin/gh-blin`.

### 4. 🧠 `goblin-control` (Control Center Core)
Node.js control center dengan modul: `check`, `cmd`, `create`, `delete`, `git`, `shortcuts`.
Otak di balik orchestration harian goblin.

### 5. 📝 `notes`
Utility notes berbasis markdown (Node.js) — `create.js` + `storage.js` untuk
manajemen catatan cepat dari terminal.

---

## ⚙️ Setup & Integrasi

### PATH (binaries)
Agar `ocm` & `gh-blin` bisa dipanggil dari mana saja, tambahkan folder `bin` ke `$PATH`:

```bash
# Tambahkan ke ~/.zshrc atau exports.sh Anda
export PATH="$PATH:$HOME/civil/goblin-vault/tools-cli/bin"
```

### `fex` (Go binary)
`fex` di-build dari `tools-cli/src/fex/` (Go module). Binary ter-deploy ke
`~/.local/bin/fex` (cek via `bash scripts/doctor.sh`). Build ulang bila perlu:

```bash
cd tools-cli/src/fex && go build -o ~/.local/bin/fex .
```

### Health Check & Lint
Sebelum kerja atau setelah perubahan, jalankan:

```bash
bash scripts/doctor.sh        # cek dependency & PATH
bash scripts/check_syntax.sh  # lint semua Bash & JS
```

### Install Configs
`install.sh` men-deploy config micro & nvim sebagai symlink ke `~/.config/`,
auto-sync dengan source-of-truth di repo ini:

```bash
bash scripts/install.sh
```

---

## 📜 Konvensi & Rules

- **Agent & kontributor:** baca `AGENTS.md` — berisi struktur, guideline engineering,
  coding standards, dan daftar tanggung jawab agent.
- **Coding style:** `docs/rules/coding-style.md` — immutability, batas ukuran file
  (≤800 baris), error handling, input validation, reusable utilities, shell ISO.
- **Skills:** definisi skill terdaftar di `kilo.jsonc` → `docs/skills/`
  (`golang-pro`, `js-mastery`, `shell-scripting`).
- **Bahasa:** dokumentasi Indonesia (utama), English untuk istilah teknis.

---

<p align="center">
  <i>Dibuat oleh Goblin, dirawat oleh Goblin, untuk kedamaian terminal Goblin. 🍻👹</i>
</p>
