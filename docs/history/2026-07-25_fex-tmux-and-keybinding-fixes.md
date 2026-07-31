# FEX — Tmux & Keybinding Fixes (2026-07-25)

> Tanggal: 2026-07-25 | Execution: goblin-maintainer + goblin-architect + goblin-documenter

Catatan: Hari ini ada 2 fase kerja — (1) commit `fab9612` yang sudah di-push ke branch, dan (2) uncommitted fixes lanjutan yang masih dalam review.

---

# 1. Refactor `tree.go` + Rename UX + Binary/kilo/CI (Commit `fab9612`)

> 2026-07-25 | Execution: goblin-maintainer (impl) + goblin-documenter (changelog)

## Deskripsi
- Refactor Issue #2: pecah `tools-cli/src/fex/internal/tree/tree.go` (393 baris) jadi `tree_core.go` + `tree_interactive.go`
- Fix rename Ctrl+R: ganti `renameDialog` dari stdin prompt ke fzf popup pre-filled dengan nama file lama
- Binary rename: `fe` → `fex` untuk konsistensi dengan folder `fex/` dan perintah `fex`
- Migrate config: `kilo.jsonc` → `opencode.jsonc`
- Tambah CI workflow `.github/workflows/opencode.yml`
- Hapus `debugLog` + semua panggilannya

## Decision
- Public API `tree.go` dipertahankan — semua exported function/type tetap dengan signature identik
- `renameDialog` menggunakan pola yang sama dengan `newFileDialog`/`newFolderDialog` (fzf popup + `enter:print-query`)
- `opencode.jsonc` dibuat dari `kilo.jsonc` dengan schema yang benar (`https://opencode.ai/config.json`)
- `.gitignore` diupdate dari `tools-cli/src/fex/fe` → `tools-cli/src/fex/fex`
- `git rm --cached tools-cli/src/fex/fe` untuk hapus binary dari git tracking

## File yang Dibuat
- `tools-cli/src/fex/internal/tree/tree_core.go`
- `tools-cli/src/fex/internal/tree/tree_interactive.go`
- `opencode.jsonc`
- `.github/workflows/opencode.yml`

## File yang Dimodifikasi
- `tools-cli/src/fex/internal/tree/tree.go` (deleted)
- `tools-cli/src/fex/fe` (deleted)
- `tools-cli/src/fex/cmd/dialogs.go`
- `tools-cli/src/fex/cmd/tree_mode.go`
- `tools-cli/src/fex/cmd/find_mode.go`
- `tools-cli/src/fex/internal/fzf/fzf.go`
- `tools-cli/src/fex/cmd/root.go`
- `kilo.jsonc` (deleted)
- `.gitignore`
- `CHANGELOG.md`

## Arsitektur
```
tools-cli/src/fex/internal/tree/
├── tree_core.go         # pure data model, filesystem helpers, formatting
│   ├── TreeEntry, TreeOptions
│   ├── DefaultExcludes, isExcludedDir, iconForExt
│   ├── ListDirContents, ParentDir, FormatTreeLine
│   └── (no fzf/ui imports)
└── tree_interactive.go   # fzf-based interactive selector
    └── SelectFromTree
```

## Verifikasi
- `go vet ./...` ✅
- `go build ./...` ✅
- `bash scripts/check_syntax.sh` ✅
- `bash scripts/doctor.sh` ✅
- Pre-commit hook hijau

## Constraints
- Pure refactor — public API tidak berubah
- Immutability rule diikuti (no in-place mutation)
- File size: tree_core.go ~240 baris, tree_interactive.go ~157 baris

## Notes
- Commit message: `refactor(fex): pecah tree.go, fix rename, migrate kilo->opencode`
- Belum di-push (BOSS minta banyak yang perlu dibenahi di branch ini)

---

# 2. Tmux & Keybinding Fixes (Uncommitted)

> 2026-07-25 | Execution: goblin-maintainer (impl)

## Deskripsi
- Fix tmux breakage: hilangkan panel kanan saat fex dijalankan di tmux
- Fix keybinding conflicts antara tmux `bind -n` global dan nvim custom mappings
- Tambah `terminal-overrides` truecolor ke `~/.tmux.conf` untuk mencegah hex color artifacts pas reattach

## Decision
- **SplitOnStartup dihapus sepenuhnya** — fex di tmux tidak lagi membuat split otomatis
- **OpenFileInPane diganti** — editor spawn di pane yang sama (sama seperti non-tmux flow)
- **Tmux keybindings:**
  - `C-n` → `C-p` (new session)
  - `C-k` → `C-d` (kill session)
  - `C-w` → unbind (dihapus)
  - `C-q` → tetap (detach)
- **Nvim keybindings:**
  - `C-q` (:q) → `C-x`
  - `C-w` (:bd) → `C-b`
  - `C-d` (duplicate line) → dihapus (BOSS pake `Alt+Shift+Down`)
- **Terminal truecolor:** tambah `set -ga terminal-overrides ',tmux-256color:Tc'`

## File yang Dimodifikasi
- `tools-cli/src/fex/cmd/root.go` (hapus block SplitOnStartup)
- `tools-cli/src/fex/cmd/tree_mode.go` (hapus tmux conditional, spawn editor langsung)
- `tools-cli/src/fex/cmd/find_mode.go` (sama)
- `tools-cli/src/fex/cmd/bookmarks_mode.go` (sama)
- `tools-cli/src/fex/cmd/search_mode.go` (sama)
- `~/.tmux.conf` (ganti keybindings + tambah terminal-overrides)
- `~/.config/nvim/lua/config/keymaps.lua` (ganti C-q→C-x, C-w→C-b, hapus C-d duplicate)

## Verifikasi
- `go vet ./...` ✅
- `go build ./...` ✅
- `tmux source-file ~/.tmux.conf` ✅
- Binary rebuilt & deployed ke `~/.local/bin/fex` ✅

## Constraints
- Belum di-commit
- Belum di-push
- Masih ada issue tmux hex color artifacts pas detach/reattach yang belum selesai diinvestigasi

## Notes
- BOSS minta commit tanpa push karena branch masih banyak yang perlu dibenahi
- Tmux hex color artifacts kemungkinan besar dari `~/.tmux.conf` status bar hex colors + `/dev/tty` state corruption pas reattach, bukan dari kode fex
