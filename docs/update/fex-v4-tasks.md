# fex v4 — Task Breakdown

## Priority Matrix

| # | Item | Effort | Impact | Priority |
|---|------|--------|--------|----------|
| 1 | Binary packaging (name + strip + install) | Small | 🔴 High | **P0** |
| 2 | GUIDE.md fix (x2 lokasi) | Trivial | 🟡 Medium | **P0** |
| 3 | go.mod module path | Trivial | 🟡 Medium | **P0** |
| 4 | Preview line-range limit | Small | 🟡 Medium | **P1** |
| 5 | fd ignore rules default | Small | 🟡 Medium | **P1** |
| 6 | Session restore + cursor position | Medium | 🟢 Medium | **P1** |
| 7 | Error handling audit | Small | 🔴 High | **P1** |
| 8 | Tests | Medium | 🔴 High | **P1** |
| 9 | Recent files | Medium | 🟢 Medium | **P2** |
| 10 | Filter presets | Medium | 🟢 Medium | **P2** |
| 11 | Sort options | Medium | 🟢 Low | **P2** |
| 12 | Image preview | Medium | 🟢 Low | **P3** |
| 13 | Batch operations | Large | 🟢 Low | **P3** |

---

## Milestone 0: Post-Migration Cleanup (P0)
Executor: goblin-maintainer

### Task 0.1: Fix binary name and packaging
- **Type**: fix
- **Files affected**:
  - `tools-cli/src/fex/cmd/root.go` (name references)
  - `tools-cli/bin/fex` (launcher script)
- **Deskripsi**: `go build ./cmd/fe/` ngasilin binary name `fe`. Perlu diubah jadi `fex`. Juga binary perlu di-strip dan ada install target.
- **Implementation detail**:
  - Build dengan `go build -o fex ./cmd/fe/`
  - Tambah `strip` step biar ukuran ~5MB
  - Bikin Makefile target: `make build`, `make install`, `make clean`
  - `make install` → copy ke `~/.local/bin/fex`
  - Update `bin/fex` launcher kalo perlu
- **Acceptance criteria**:
  - `fex` binary terinstall di PATH
  - Ukuran ≤6MB setelah stripped
  - Launcher script detek binary dan exec langsung
- **Risk**: low
- **Status**: PENDING

### Task 0.2: Fix GUIDE.md content
- **Type**: fix
- **Files affected**:
  - `tools-cli/docs/GUIDE.md`
  - `tools-cli/src/fex/docs/GUIDE.md`
- **Deskripsi**: Dua file GUIDE.md isinya dokumentasi OCM, bukan fex. Ini hasil copas error.
- **Implementation detail**:
  - Hapus dua file tersebut
  - Atau isi dengan dokumentasi fex yang proper (cara instalasi, usage, modes)
- **Acceptance criteria**:
  - Gak ada lagi dokumentasi OCM di tools-cli/
  - Kalo diisi docs baru, isinya sesuai fex
- **Risk**: trivial
- **Status**: PENDING

### Task 0.3: Fix go.mod module path
- **Type**: fix
- **Files affected**:
  - `tools-cli/src/fex/go.mod`
  - Semua file .go dengan import path
- **Deskripsi**: `module civil/goblin-vault/tools-cli/src/fex` — fragile banget. Kalo repo dipindah, semua import patah.
- **Implementation detail**:
  - Ganti module path ke sesuatu yang lebih portable, misal `github.com/shobixlinux/fex`
  - `go mod edit -module github.com/shobixlinux/fex`
  - Update semua import di .go files (bisa pake `sed` atau gofmt)
- **Acceptance criteria**:
  - `go build` masih jalan setelah module path diganti
  - Import path konsisten di semua file
- **Risk**: medium
- **Dependencies**: none
- **Status**: PENDING

---

## Milestone 1: Core Polish (P1)
Executor: goblin-developer

### Task 1.1: Add preview line-range limit
- **Type**: enhancement
- **Files affected**:
  - `tools-cli/src/fex/internal/config/config.go`
  - `tools-cli/src/fex/internal/tree/tree.go` (preview command)
- **Deskripsi**: Preview file besar sekarang gak ada batasan, bisa freeze UI kalo file minified/log gede.
- **Implementation detail**:
  - Tambah config `PreviewLineRange` default 80
  - Apply ke `bat` → `bat --line-range :80`
  - Fallback `cat -n` → pipe ke `head -80`
- **Acceptance criteria**:
  - Preview file besar stop di line 80
  - Preview file kecil (<80 lines) tetap full
- **Risk**: low
- **Status**: PENDING

### Task 1.2: Fix fd ignore rules default
- **Type**: enhancement
- **Files affected**:
  - `tools-cli/src/fex/internal/tree/tree.go`
  - `tools-cli/src/fex/internal/config/config.go`
- **Deskripsi**: `fd --no-ignore-vcs` bypass `.gitignore` — hasil browsing noisy.
- **Implementation detail**:
  - Default: pake `fd` tanpa `--no-ignore-vcs`
  - Tambah flag `--all` di CLI buat include ignored files
  - Update help text
- **Acceptance criteria**:
  - Default browsing respect .gitignore
  - `fex --all` include ignored files
- **Risk**: low
- **Status**: PENDING

### Task 1.3: Session restore + cursor position
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/internal/session/session.go`
  - `tools-cli/src/fex/cmd/root.go`
- **Deskripsi**: Setiap buka fex start dari CWD. Belum ada session persistence.
- **Implementation detail**:
  - Save last directory + file ke `~/.cache/fex/session.json`
  - Flag `--restore` buat balik ke session terakhir
  - Auto-save di exit handler
- **Acceptance criteria**:
  - `fex --restore` balik ke folder terakhir
  - Session file persist di cache
- **Risk**: medium
- **Status**: PENDING

### Task 1.4: Error handling audit
- **Type**: improvement
- **Files affected**:
  - Semua file di `internal/`
  - `cmd/root.go`
- **Deskripsi**: Pastikan semua error dari os/exec dan file operations di-handle gracefully.
- **Implementation detail**:
  - Audit all `exec.Command` — fallback message kalo tool missing
  - Audit file operations — proper error messages, no silent failure
  - Exit codes: 0 = sukses, 1 = error umum, 2 = user cancel
- **Acceptance criteria**:
  - Tool missing → pesan jelas, gak crash
  - File operation gagal → error message, gak silent
  - Exit code sesuai konvensi
- **Risk**: medium
- **Status**: PENDING

### Task 1.5: Add tests
- **Type**: testing
- **Files affected**:
  - `tools-cli/src/fex/internal/config/config_test.go`
  - `tools-cli/src/fex/internal/session/session_test.go`
  - `tools-cli/src/fex/internal/fzf/fzf_test.go`
  - `tools-cli/src/fex/internal/tree/tree_test.go`
- **Deskripsi**: Belum ada test sama sekali. Minimal coverage untuk core logic.
- **Implementation detail**:
  - Unit test untuk config loader (viper)
  - Unit test untuk session state + bookmarks
  - Unit test untuk tree navigation (listing, filtering)
  - Test untuk fzf argument builder
- **Acceptance criteria**:
  - `go test ./...` jalan tanpa error
  - Minimal 50% coverage di package config, session, tree
- **Risk**: medium
- **Status**: PENDING

---

## Milestone 2: Feature Polish (P2)
Executor: goblin-developer

### Task 2.1: Recent files cache + browsing mode
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/internal/session/session.go`
  - `tools-cli/src/fex/cmd/root.go`
  - `tools-cli/src/fex/internal/config/config.go`
- **Deskripsi**: Cache 20 file terakhir yang dibuka, accessible via `fex --recent`.
- **Implementation detail**:
  - Cache file di `~/.cache/fex/recent` — format JSON
  - Update cache setiap kali file dibuka (di tmux.go open action)
  - Mode baru `--recent` — read cache + pipe ke fzf
  - Batas max 20 entry, dedup, timestamp
- **Acceptance criteria**:
  - Setiap file yang dibuka tercatat
  - `fex --recent` tampilkan daftar recent
  - Max 20 entry, yang lama kehapus otomatis
- **Risk**: medium
- **Status**: PENDING

### Task 2.2: Filter presets
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/cmd/root.go` (arg parsing)
  - `tools-cli/src/fex/internal/tree/tree.go` (extension filter)
  - `tools-cli/src/fex/internal/config/config.go` (preset definitions)
- **Deskripsi**: Flag shortcut untuk filter multi-extension: `--code`, `--docs`, `--images`, `--config`, `--web`.
- **Implementation detail**:
  - Define preset map di config: `Code → []string{".js", ".ts", ...}`
  - Parse flag di root.go, resolve ke extension list
  - Apply ke fd/find command builder
  - Preset + manual extension = merge
- **Acceptance criteria**:
  - `fex --code` filter semua extension code
  - `fex --code .go` filter code + .go aja
  - Help text daftar preset
- **Risk**: medium
- **Status**: PENDING

### Task 2.3: Sort options
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/cmd/root.go`
  - `tools-cli/src/fex/internal/tree/tree.go`
- **Deskripsi**: `fex --sort=name|date|size` buat sort hasil browse.
- **Implementation detail**:
  - Parse `--sort` flag di root.go
  - Name: default alphabetical
  - Date: `fd --changed-within` atau `ls -t` fallback
  - Size: `ls -S` atau pipe sort
- **Acceptance criteria**:
  - Tiga mode sorting jalan dengan benar
  - Default tetap name (backward compatible)
- **Risk**: medium
- **Status**: PENDING

---

## Milestone 3: Nice to Have (P3)
Executor: goblin-developer

### Task 3.1: Image preview
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/internal/ui/detect.go`
  - `tools-cli/src/fex/internal/config/config.go`
- **Deskripsi**: Preview image kalo backend tersedia (chafa/catimg/viu/kitty icat).
- **Implementation detail**:
  - Deteksi backend di config init
  - Image file → panggil backend preview
  - Non-image → preview text biasa
  - Fallback aman kalo gak ada backend
- **Acceptance criteria**:
  - Image preview jalan kalo ada backend
  - Gak ngerusak preview text
- **Risk**: medium
- **Status**: PENDING

### Task 3.2: Batch operations (multi-select)
- **Type**: feature
- **Files affected**:
  - `tools-cli/src/fex/internal/fzf/fzf.go`
  - `tools-cli/src/fex/cmd/root.go`
- **Deskripsi**: Multi-select Tab → action: move, copy, compress.
- **Implementation detail**:
  - Bind baru: Ctrl-m (move), Ctrl-c (copy), Ctrl-z (compress)
  - Action pilih destination folder via fzf
  - Eksekusi batch + reload + notifikasi
- **Acceptance criteria**:
  - Multi-select bisa di-move, copy, compress
  - Cancel aman, gak ada partial operation
- **Risk**: high
- **Status**: PENDING

---

## Suggested Execution Order

```
M0:  0.1 → 0.2 → 0.3    (post-migration cleanup)
M1:  1.4 → 1.1 → 1.2 → 1.5 → 1.3    (error handling first, then polish, then tests, then feature)
M2:  2.1 → 2.2 → 2.3
M3:  3.1 → 3.2
```

## Global Notes

- **Go code only** — jangan nambah bash modules baru. Kalo butuh logic baru, tulis di Go.
- **Helpers/ bash** cuma untuk tmux operations — itu satu-satunya alasan bash masih ada.
- **Backward compatibility**: argument structure `fe` lama harus tetap jalan di `fex`.
- **shellcheck** untuk setiap perubahan di helpers/*.sh
- **go test ./...** harus lulus sebelum commit/merge
- Banner version: `v4.0 - Polished`
