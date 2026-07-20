# Goblin Vault — OSS Foundation & Refactors (2026-07-20)

> Tanggal: 2026-07-20 | Execution: goblin-architect (design), goblin-reviewer (review), goblin-maintainer (impl), goblin-documenter (draft)

Catatan: Hari ini ada beberapa implementasi. Sesuai rule, semua digabung ke 1 file
`tanggal_nama.md` dan di-append ke bawah (bukan file terpisah per implementasi).

---

# 1. Open-Source Foundation Core

> 2026-07-20 | Execution: goblin-maintainer + review goblin-reviewer

## Deskripsi
Membangun pondasi repo open-source yang solid: license, gitignore hardened,
editorconfig, CI GitHub Actions, git hooks (pre-commit/pre-push), dan installer hook.
Tujuannya: automate quality gate & hygiene supaya error/secret/break gak lolos ke
`dev`/`main` tanpa ketahuan.

## Decision
- **License:** MIT (paling umum & permisif untuk OSS).
- **CI:** GitHub Actions (native, gratis untuk publik repo).
- **Hooks:** core git hooks + installer script (bukan pre-commit framework) — no Python dep.
- **Scope:** core dulu (CI + hooks + LICENSE), full foundation (CONTRIBUTING/SECURITY/
  templates/Makefile) ditunda & didraft ke `docs/update/full-foundation.md`.

## File yang Dibuat
- `LICENSE` (MIT)
- `.editorconfig`
- `.github/workflows/ci.yml`
- `.github/hooks/pre-commit`
- `.github/hooks/pre-push`
- `scripts/install-hooks.sh`

## File yang Dimodifikasi
- `.gitignore` (fix: sebelumnya ignore diri sendiri + file krusial AGENTS.md/kilo.jsonc/docs;
  sekarang guard secret + build artifact)

## File yang Dihapus
- (none)

## Arsitektur
```
.github/
├── workflows/ci.yml     # setup-go + setup-node -> check_syntax, doctor, go vet, build ./cmd/fe, smoke
└── hooks/
    ├── pre-commit       # syntax + doctor (blocking)
    └── pre-push         # doctor + build fex (mktemp) + syntax
scripts/install-hooks.sh # symlink relative .github/hooks -> .git/hooks
```

## Verifikasi
- `bash scripts/check_syntax.sh` ✅
- `bash scripts/doctor.sh` ✅
- `go build ./cmd/fe/` ✅
- pre-commit & pre-push hook terbukti jalan saat commit/push.

## Constraints
- CI `go-version-file: go.mod`, Node LTS 20.
- Hook pakai `set -euo pipefail`.

## Notes
- Reviewer nemu bug awal: `go build .` gagal karena entry ada di `cmd/fe/` -> di-fix ke
  `./cmd/fe`. Pre-push sempat block push sampai di-fix.

---

# 2. Hook & CI Hardening (Hasil Review)

> 2026-07-20 | Execution: goblin-reviewer (review) -> goblin-maintainer (fix)

## Deskripsi
Pasca foundation, `goblin-reviewer` review & nemu gap: doctor warn-only di pre-commit,
pre-push gak jalanin doctor, hook absolute symlink (break di worktree), `.gitignore`
kurang artifact, `check_syntax.sh` scan semua file & node_modules. Di-fix semua.

## Decision
- pre-commit `doctor.sh` jadi **blocking** (bukan warn-only).
- pre-push tambah `doctor.sh` + build ke `mktemp` (hindari `/tmp/fex` race).
- `install-hooks.sh`: **relative symlink** (`../../.github/hooks/...`) + detect
  `core.hooksPath` override + hapus `chmod` source.
- `check_syntax.sh`: filter `*.sh`/`*.bash`, exclude `node_modules`, fix `go vet` counting.
- CI: pin Go via `go.mod`, Node LTS 20, tambah `go vet ./...`, hapus `|| true` smoke.

## File yang Dibuat
- (none baru, modifikasi existing)

## File yang Dimodifikasi
- `.github/hooks/pre-commit`
- `.github/hooks/pre-push`
- `scripts/install-hooks.sh`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.editorconfig`
- `scripts/check_syntax.sh`

## Verifikasi
- Re-install hooks -> relative symlink ter-verify.
- `check_syntax.sh` output jauh lebih bersih (gak scan binary/node_modules).
- Pre-commit sekarang block kalau dep hilang.

## Notes
- Beberapa temuan reviewer adalah false-positive (smoke `|| true`, go vet subshell) ->
  sengaja gak diikuti.

---

# 3. Draft Full OSS Foundation (Backlog)

> 2026-07-20 | Execution: goblin-maintainer (draft)

## Deskripsi
Karena full foundation di-skip implementasi, idenya ditaruh ke backlog terstruktur
biar gak ilang.

## File yang Dibuat
- `docs/update/full-foundation.md`

## File yang Dimodifikasi
- (none)

## Notes
Isi: CONTRIBUTING, SECURITY, CODEOWNERS, issue/PR templates, Makefile, dependabot/
stale/release CI, + tech-debt refactor. Berstatus backlog (belum dikerjakan).

---

# 4. Refactor `cmd/root.go` — Issue #1 (Closes #1)

> Issue #1 | 2026-07-20 | Design: goblin-architect | Impl: goblin-maintainer (M1->M3 estafet)

## Deskripsi
Pecah `tools-cli/src/fex/cmd/root.go` (989 baris) yang melanggar coding-style rule #2
(max 800, ideal 200-400). Dibagi 3 milestone, dikerjain sequential di 1 sesi maintainer
pakai skill `golang-pro`.

## Decision
- Semua fungsi di package `cmd` SAMA -> pindah file gak ubah visibility, gak perlu export.
- `Execute()` & `init()` TETAP di root.go (main.go panggil, init daftarin flag cobra).
- `shEscape` diekstrak ke `internal/util/escape.go` sebagai `util.ShEscape` (reusable, rule #6).
- Closure `findEntry` ikut pindah bersama `runTreeMode`.
- JANGAN ubah logika (slice-mutasi di bindings biarkan -> tech-debt terpisah).
- Tidak pakai interface pattern (over-engineering untuk 4 mode).

## File yang Dibuat
- `tools-cli/src/fex/internal/util/escape.go` (ShEscape)
- `tools-cli/src/fex/cmd/filelist.go`
- `tools-cli/src/fex/cmd/dialogs.go`
- `tools-cli/src/fex/cmd/bindings.go`
- `tools-cli/src/fex/cmd/find_mode.go`
- `tools-cli/src/fex/cmd/search_mode.go`
- `tools-cli/src/fex/cmd/bookmarks_mode.go`
- `tools-cli/src/fex/cmd/tree_mode.go`

## File yang Dimodifikasi
- `tools-cli/src/fex/cmd/root.go` (989 -> **140 baris**: hanya dispatcher + flags + Execute/init)
- `CHANGELOG.md` (entri refactor, Closes #1)

## Arsitektur (cmd/ setelah refactor)
```
cmd/
├── root.go          ~140  # dispatcher + flags + Execute() + init()
├── backup.go        ~169  # pre-existing
├── tree_mode.go     ~281  # runTreeMode + closure findEntry
├── bookmarks_mode.go ~73  # runBookmarksMode
├── search_mode.go   ~123  # runSearchMode
├── find_mode.go     ~185  # runFindMode, extStr, pickFileWithFd
├── bindings.go      ~64   # buildFindModeBindings, buildTreeModeBindings
├── dialogs.go       ~122  # 5 dialog + executeDelete
├── filelist.go      ~73   # getFileList, getFdFileList, makeAbs
└── fe/                    # build entry
internal/util/escape.go      # ShEscape
```

## Verifikasi
- `go build ./cmd/fe/` ✅
- `go vet ./cmd/...` ✅
- `bash scripts/check_syntax.sh` ✅
- `bash scripts/doctor.sh` ✅ (pre-commit + pre-push hook jalan)
- `wc -l cmd/root.go` = 140 (≤200) ✅
- Issue #1 **CLOSED** di GitHub.

## Constraints
- Behavior identik (pure refactor, bukan perubahan fitur).
- `Execute()`/`init()` signature tidak berubah.

## Notes
- Commit bertahap M1/M2/M3 (tiap milestone 1 commit) biar review gampang.
- Ditemukan: file krusial (AGENTS.md/kilo.jsonc/docs) ternyata belum ke-track gara-gara
  .gitignore jadul -> di-fix di commit terpisah `2e9ea02`.

---

# 5. Track Critical Files (Gitignore Fix)

> 2026-07-20 | Execution: goblin-maintainer

## Deskripsi
Pas mau commit refactor, ketemu `AGENTS.md`, `kilo.jsonc`, `docs/rules`, `docs/skills`,
`docs/update/fex-v4*` muncul sebagai untracked — padahal dikira sudah di-commit di
session awal. Root cause: `.gitignore` JADUL meng-ignore mereka, jadi commit docs dulu
gagal track (git silent-skip). Sekarang `.gitignore` sudah benar & file wajib di-track.
Juga ignore binary build `tools-cli/src/fex/fe` (11MB) biar gak ke-commit.

## File yang Dibuat
- (none baru, track existing)

## File yang Dimodifikasi
- `.gitignore` (tambah `tools-cli/src/fex/fe`)

## File yang Dihapus
- (none)

## Verifikasi
- `git ls-files` konfirmasi AGENTS.md/kilo.jsonc/docs/* sekarang TRACKED.
- `git status` clean (binary `fe` di-ignore).

## Notes
Penting: Kilo sekarang beneran load `AGENTS.md` + `docs/rules/coding-style.md` tiap
session setelah file ini ter-track.
