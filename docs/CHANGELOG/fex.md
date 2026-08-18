# Changelog — `fex`

> Riwayat lengkap perubahan dan evolusi untuk tool **`fex`** (File Explorer — Go, fzf + tmux).
> Dari bash satu file, jadi Go hybrid. Perjalanan seorang goblin.  
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [v0.3.16] - 2026-08-18

### Added

- **Instant Mode Switcher via `Tab` (`cmd/root.go`, `cmd/find_mode.go`, `cmd/tree_mode.go`, `cmd/search_mode.go`)**:
  - Menambahkan tombol **`Tab`** sebagai switch mode instan antara **Tree Mode (`🌳`)** dan **Flat Find Mode (`🔍`)** secara in-memory tanpa perlu keluar dari `fex`.
  - State direktori aktif (`cwd`) tetap terjaga penuh saat beralih mode.
- **Interactive File Copy, Move (Cut), and Paste Engine (`cmd/clipboard.go`, `cmd/find_mode.go`, `cmd/tree_mode.go`, `cmd/search_mode.go`)**:
  - Shortcut interaktif `Alt-c` (Mark Copy) dan `Alt-m` (Mark Move / Cut) untuk menandai target file/folder langsung dari UI FZF.
  - Shortcut `Ctrl-v` (dan fallback `Alt-v`) untuk mengeksekusi penempelan file/folder di direktori yang sedang aktif.
  - **Cross-Directory Persistence**: Menggunakan file status persisten `/tmp/fex-clip-$USER.json`.
  - **Dynamic In-TUI Toast & Clipboard Badge**: Status salin/pindah/tempel ditampilkan langsung di header FZF tanpa mengotori stdout/stderr terminal luar.
  - **Smart Cursor Retention**: Kursor tetap diam di posisi file yang sedang di-mark (`Alt-c`/`Alt-m`) dan langsung fokus ke file yang baru ditempel (`Ctrl-v`) menggunakan sinkronisasi `--sync` + `load:pos(N)`.
  - Unit test komprehensif `cmd/clipboard_test.go` (100% passing). (Closes #4)
- **Universal Clipboard & In-TUI Git Viewer (`cmd/dialogs.go`, `cmd/clipboard.go`)**:
  - **`Ctrl-G` In-TUI Git Viewer**: Menampilkan git status dan 15 commit terakhir di dalam popup FZF interaktif yang bersih tanpa ada teks yang bocor ke luar terminal.
  - **`Ctrl-Y` Universal Clipboard**: Menggunakan ANSI sequence universal **OSC 52** (kompatibel penuh dengan Tmux, WezTerm, Alacritty, Kitty, Windows Terminal) + fallback `wl-copy`, `xclip`, `pbcopy` dan menampilkan In-TUI toast status.
  - **`Ctrl-F` Search Switcher**: Menekan `Ctrl-F` di mode browse langsung beralih ke pencarian konten file interaktif via Ripgrep.
  - **`Ctrl-H` / `?` Keybindings Help Popup**: Menampilkan cheatsheet panduan shortcut keyboard interaktif langsung dari dalam TUI dengan retensi posisi kursor saat ditutup.

---

## [v0.3.15] - 2026-07-28

### Added

- **Global Ultra-Clean ASCII Art Banners (bagian dari suite CLI GN, ZF, FEX, OCM)**:
  - Penyesuaian banner visual seragam dengan font ASCII Art tebal presisi tinggi.
  - Penempatan nama tool dan versi persis di bawah banner dengan skema warna pure white & margin atas yang lega agar tidak menempel di prompt terminal (`shobixlinuxdev>`).

## [v0.3.0] - 2026-07-26

### Changed

- **Rename entrypoint Go module** dari `cmd/fe` ke `cmd/fex` untuk konsistensi penamaan binary & launcher script `tools-cli/bin/fex`.
- **`refactor(fex)`**: pecah `cmd/root.go` (989 baris) jadi modul domain (`tree_mode`, `bookmarks_mode`, `search_mode`, `find_mode`, `bindings`, `dialogs`, `filelist`) + extract `internal/util/escape.go` — Closes #1.
- **`refactor(fex)`**: pecah `tree.go` (393 baris) jadi `tree_core.go` (240 baris, pure data model & filesystem helpers) + `tree_interactive.go` (157 baris, fzf-based selector) — Closes #2. Public API tetap, `go vet` & `go build` pass.
- **Binary rename**: `fe` → `fex` — konsisten dengan nama folder `fex/` & perintah `fex`, update `.gitignore` & rebuild ke `~/.local/bin/fex`.
- **`fex backup micro`** — backup micro editor config dari `~/.config/micro/` ke `goblin-vault/configs/micro/`.
- **`fex restore micro`** — restore micro editor config dari `goblin-vault/configs/micro/` ke `~/.config/micro/`.

### Fixed

- **Rename Ctrl+R**: rename kedua gagal (file "ngelock") — fix hapus `sess.SetLastOpened(newPath)` dari rename case (bukan navigasi), perbaiki `findEntry` fallback dari `strings.Contains` ke `strings.HasSuffix` dengan separator boundary, surface error `os.Rename` ke stderr, hapus guard `lines[idx] != ""` di parser `--expect` fzf.go, ganti `renameDialog` dari stdin prompt ke fzf popup dengan nama file otomatis terisi (pre-filled Query), hapus debugLog calls dari `tree_mode.go`.
- **Tmux breakage**: panel kanan/terminal baru aneh pas fex jalan di tmux — hapus `SplitOnStartup` sepenuhnya, editor sekarang spawn di pane yang sama (bukan di panel kanan), hapus semua `tmux.InTmux()` conditional di `tree_mode.go`, `find_mode.go`, `bookmarks_mode.go`, `search_mode.go`.
- **Keybinding conflicts tmux ↔ nvim**: tmux `bind -n C-n/C-k/C-w` bentrok sama nvim custom mappings — tmux `C-n` pindah ke `C-p`, tmux `C-k` pindah ke `C-d`, tmux `C-w` dihapus; nvim `C-q` pindah ke `C-x`, nvim `C-w` pindah ke `C-b`, nvim `C-d` duplicate line dihapus.

## [v0.1.0] - 2026-07-08

### Fixed

- `fex` tree mode: Esc/Ctrl-H now respects `$HOME` boundary — exits tree at root instead of navigating above home.
- `fex` tree mode: scroll wrap via `--cycle` flag (cyclical scrolling top→bottom and vice versa).
- `fex` create file/folder dialog: replaced `--expect` + dummy-item pattern with `enter:print-query` binding + empty stdin — no more empty list exit code 1.
- `fex`: after file/dir create, new file is automatically opened in editor (tmux-aware with `tmux.OpenFileInPane` fallback).
- `fex`: removed `sess.SetLastOpened` after create — prevents search input from being filled with new file name.
- `fex`: diagnostic scripts no longer report false alarms.

### Changed

- `fex`: complete rewrite from shell-based `fe` to Go CLI `fex` (v4.0) — modular architecture with subcommands (`tree`, `search`, `create`, `editor`, `path`, `kill`).
- `fex`: internal fzf API — added `Cycle` field and `--cycle` arg emission.

### Removed

- `scripts/fe` — fully replaced by `fex` Go binary.
- `scripts/fe.bak.*` — stale backup files.

---

## 📜 Historic Milestones & Legacy Releases

### v4.0 — Go Hybrid (Codename: `fex`)

_Migrasi total dari bash ke Go hybrid. Reinkarnasi dari `fe`._

- 🦫 **Go core** — Cobra CLI, Viper config, proper error handling, concurrent-safe session.
- 🎯 **4 modes**: find, tree, search, bookmarks — unified under `fex [mode] [args]`.
- ⚙️ **YAML config** — `~/.config/fe/config.yaml` + env override (`FE_` prefix).
- 🔧 **Tool auto-detect** — `bat > cat`, `micro > nano > vim`, `fd > WalkFiles`.
- 🗑️ **Delete confirm** — fzf dialog, bukan `rm -i`.
- ✏️ **Rename dialog** — interactive, bukan `read -p`.
- 🆕 **New file / folder** dari tree mode.
- 📋 **Copy path** to clipboard.
- 🔍 **Full-screen preview** toggle.
- 🎨 **File type icons** — Nerd Font per extension.
- 📄 **Generic fzf wrapper** — `RunFzf[T]` dengan type params.

### v3.0 — Modular Bash (Codename: `fe modular`)

_Bash script dipecah dari 1 file → 8 modul terstruktur._

- 📦 **Modular source** — `config.sh`, `tmux.sh`, `ui.sh`, `find.sh`, `tree.sh`, `search.sh`, `bookmarks.sh`, `popup_input.sh`.
- 🌳 **Tree mode** — folder explorer dengan inline fzf.
- 📑 **Bookmarks mode** — dedicated bookmark browser.
- 🔎 **Search mode** — ripgrep integration.
- 🖥️ **Popup input** — tmux display-popup / fzf / read fallback.

### v2.0 — +micro (Codename: `fe + editor`)

_Single bash script (~198 lines) dengan micro editor & tmux split._

- 🖥️ **Tmux split** — auto split window, open file di right pane.
- 📝 **Micro integration** — preferred editor (fallback nano/vim).
- 📑 **Bookmarks** — add via Ctrl-b, file-backed.

### v1.0 — Explorer OG (Codename: `fe original`)

_The beginning. File explorer pakai fzf._

- 📂 **Browse files** — `fe [path]` → fzf.
- 🔍 **Filter by extension** — `fe .js`.
- 🚀 **Open in editor** — hardcoded micro (`find | fzf | micro`).
