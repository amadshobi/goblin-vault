# fex v4 — Polish Plan

> **File Explorer** — fzf + tmux split based. **Go hybrid**, v4.0
> Letak: `tools-cli/bin/fex` (launcher) + `tools-cli/src/fex/` (Go source + bash helpers)

---

## 🏗️ Current Architecture

```
bin/fex             → Shell launcher (check PATH → exec Go binary / build from source)

src/fex/
├── cmd/fe/
│   └── main.go     → Entry point (panggil cmd.Execute())
├── cmd/root.go     → Cobra root command + mode dispatcher
├── internal/
│   ├── config/
│   │   └── config.go   → Viper YAML config loader + tool auto-detect
│   ├── fzf/
│   │   └── fzf.go      → Generic FZF wrapper (RunFzf[T], spawn fzf via os/exec)
│   ├── session/
│   │   └── session.go  → Session state (CWD, bookmarks, thread-safe)
│   ├── tmux/
│   │   └── tmux.go     → Tmux wrapper (Go → Bash bridge via helpers/)
│   ├── tree/
│   │   └── tree.go     → Tree navigation + file listing (fd/Go WalkFiles)
│   └── ui/
│       ├── ui.go       → ANSI styling, icons, terminal size
│       └── detect.go   → Tool detection (bat, editor, fd)
├── helpers/
│   ├── fzf-pick.sh      → Generic fzf picker with preview
│   ├── tmux-split.sh    → Tmux split-window helper
│   └── tmux-new-window.sh → Tmux new-window helper
└── go.mod / go.sum
```

**Key pattern:** Go handles core logic (CLI, config, state, file ops, fzf dispatch). Bash helpers handle tmux operations (split, window management) — karena lebih natural di shell.

---

## ✅ Solved by Migration (was P0/P1 di bash, auto-solved di Go)

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 1 | Rename flow fragile state | ✅ Auto-solved | Go pake `os.Rename()` + error handling proper, no temp files |
| 2 | Delete confirm dialog | ✅ Auto-solved | Go udah pake fzf confirm dialog (`Ctrl-d` dua kali) |
| 3 | Search mode input | ✅ Auto-solved | Go pake fzf wrapper, query via flag `--search` |
| 4 | Quotes safety (path with spaces) | ✅ Auto-solved | Go handle string quoting native, `os/exec` aman |
| 5 | Tree mode refactor | ✅ Auto-solved | Go udah function-based, no inline binds raksasa |
| 6 | FZF args consistency | ✅ Auto-solved | Go pake `RunFzf[T]` generic wrapper — unified |
| 12 | File type icons | ✅ Auto-solved | Udah ada di `ui.go` — icon map per extension |

---

## 🎯 Still Relevant for Go Version

### P0 — Infrastructure

### 1. Binary Packaging
- **Masalah**: `go build` ngasilin nama `fe` bukan `fex`. Binary 11MB, belum di-strip. Belum ada install target.
- **Todo**:
  - `go build -o fex ./cmd/fe/` → binary name `fex`
  - `strip` binary → turun ke ~5-6MB
  - Bikin `make install` yang copy ke `~/.local/bin/`
  - Update `bin/fex` launcher script kalo perlu

### 2. GUIDE.md Fix (x2 lokasi)
- **Masalah**: `tools-cli/docs/GUIDE.md` dan `src/fex/docs/GUIDE.md` isinya dokumentasi OCM, bukan fex
- **Todo**: Hapus atau ganti dengan fex docs yang bener

### 3. go.mod Module Path
- **Masalah**: `module civil/goblin-vault/tools-cli/src/fex` — path panjang, fragile kalo repo dipindah
- **Todo**: Ganti ke `module github.com/shobixlinux/fex` atau path yang lebih portable

---

### P1 — Polish

### 4. Preview Line-Range Limit
- **Masalah**: Preview pake `bat` tanpa `--line-range`, file gede (minified JS, CSV, log) bisa nge-freeze
- **Todo**: Tambah `--line-range :80` di preview command config

### 5. fd Optimization / Ignore Rules
- **Masalah**: `fd --no-ignore-vcs` bypass `.gitignore` — hasil browsing noisy
- **Todo**: Default tanpa `--no-ignore-vcs`, tambah flag `--all` buat include ignored files

### 6. Session Restore + Cursor Position
- **Masalah**: Setiap buka fex start dari CWD. Belum ada session persist (recent dirs, last file)
- **Todo**:
  - Cache last directory + last opened file
  - Flag `--restore` buat balik ke session terakhir
  - Simpan di `~/.cache/fex/session.json`

---

### P2 — Features

### 7. Recent Files
- Cache 20 file terakhir di `~/.cache/fex/recent`
- Mode baru: `fex --recent`
- Timestamp + label 🕐

### 8. Filter Presets
```
fex --code    → .js,.ts,.jsx,.tsx,.py,.go,.rs,.rb,.php,.sh,.java,.c,.cpp,.h
fex --docs    → .md,.mdx,.txt,.pdf,.doc,.docx,.xlsx,.csv
fex --images  → .jpg,.jpeg,.png,.gif,.svg,.webp,.ico,.bmp
fex --config  → .json,.yaml,.yml,.toml,.ini,.cfg,.conf,.env
fex --web     → .html,.css,.js,.jsx,.ts,.tsx,.json
```

### 9. Sort Options
- `fex --sort=name|date|size`
- Date → `ls -t` / `fd --changed-within`
- Size → pipe ke `sort -h`

### 10. Image Preview (Nice to Have)
- Deteksi backend: `chafa` > `catimg` > `viu` > `kitty icat`
- Ganti preview command kalo file image

### 11. Batch Operations (Multi-Select)
- Tab multi-select → action menu:
  - `Ctrl-m` → move ke folder
  - `Ctrl-c` → copy ke folder
  - `Ctrl-z` → compress zip/tar.gz

---

### P3 — Testing & Quality

### 12. Tests!
- **Go**: unit test untuk core logic (config, session, fzf wrapper, file ops)
- **Bash**: `shellcheck` untuk helpers/*.sh
- Coverage minimal: config, session, tree navigation

### 13. Error Handling Audit
- Pastikan semua error dari `os/exec` (fd, rg, bat) di-handle gracefully
- Fallback message kalo tool gak ada
- Exit code proper

---

## 📋 Priority Matrix (Go Version)

| # | Item | Effort | Impact | Priority |
|---|------|--------|--------|----------|
| 1 | Binary packaging (name + strip + install) | Small | 🔴 High | **P0** |
| 2 | GUIDE.md fix | Trivial | 🟡 Medium | **P0** |
| 3 | go.mod path | Trivial | 🟡 Medium | **P0** |
| 4 | Preview line-range | Small | 🟡 Medium | **P1** |
| 5 | fd ignore rules default | Small | 🟡 Medium | **P1** |
| 6 | Session restore | Medium | 🟢 Medium | **P1** |
| 7 | Recent files | Medium | 🟢 Medium | **P2** |
| 8 | Filter presets | Medium | 🟢 Medium | **P2** |
| 9 | Sort options | Medium | 🟢 Low | **P2** |
| 10 | Image preview | Medium | 🟢 Low | **P3** |
| 11 | Batch operations | Large | 🟢 Low | **P3** |
| 12 | Tests | Medium | 🔴 High | **P1** |
| 13 | Error handling audit | Small | 🔴 High | **P1** |

---

## 🧠 Notes

- **Go jadi primary**, bash helpers cuma buat tmux glue — ini final, jangan balik ke bash
- **Backward compatibility**: `fex` harus bisa dipanggil dengan argument structure yang sama kayak `fe`
- **No new external dependencies** (no npm, pip, cargo — Go stdlib + existing tools cukup)
- **Testing**: Go `go test` untuk core, `shellcheck` untuk helpers
- **Version**: `v4.0 - Polished` — banner, help text, semua rujuk ke fex
