# Changelog — `fex`

> Riwayat lengkap perubahan untuk tool **`fex`** (File Explorer — Go, fzf + tmux).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

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

## [0.1.0] - 2026-07-08

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

## [0.0.2] - 2026-07-07

### Changed
- `fe` (file explorer) — refactored to modular architecture (v3.0) with popup-based rename/delete, search popup, quoting safety, keybinding overhaul.
- `fe` helper scripts: simplified `popup_input.sh`, replaced temp helper with static `fe-helper.sh`.

## [0.0.1] - 2026-07-06

### Added
- `fe` — file explorer shell script (v1.0).
