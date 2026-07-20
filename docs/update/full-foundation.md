# Full Open-Source Foundation — Draft & Backlog

> Dokumen ini menyimpan ide & rencana untuk melengkapi pondasi repo open-source
> **Goblin Vault** ke level "production-ready OSS". Dibuat karena BOSS memutuskan
> skip implementasi langsung (fokus ke core: LICENSE, CI, hooks — sudah di-shipp).
> Semua item di bawah masih **belum dikerjakan** — gunakan sebagai backlog.

Tanggal draft: 2026-07-20

---

## Status Saat Ini (Sudah Selesai — Core)

| Komponen | File | State |
|----------|------|-------|
| LICENSE (MIT) | `LICENSE` | ✅ done |
| .gitignore hardened | `.gitignore` | ✅ done |
| .editorconfig | `.editorconfig` | ✅ done |
| CI GitHub Actions | `.github/workflows/ci.yml` | ✅ done |
| Git hooks (pre-commit/pre-push) | `.github/hooks/*` | ✅ done |
| Hook installer | `scripts/install-hooks.sh` | ✅ done |

---

## Backlog — Full Foundation (Belum Dikerjakan)

### 1. Community Health Files

- [ ] **`CONTRIBUTING.md`** — panduan kontributor.
  - Merujuk `AGENTS.md` (struktur, guideline engineering) & `docs/rules/coding-style.md`.
  - Cara setup: `bash scripts/install.sh` + `bash scripts/install-hooks.sh`.
  - Flow branch: pakai `scripts/worktree.sh` atau branch `fix/*`, `feat/*`.
  - Commit convention: `[scope] title` (contoh `fix(fex): ...`, `ci: ...`).
  - Pastikan `bash scripts/doctor.sh` & `check_syntax.sh` hijau sebelum PR.

- [ ] **`SECURITY.md`** — kebijakan keamanan.
  - Peringatan: **jangan commit secret** (`.env`, `*.key`, `credentials.json` sudah di-gitignore).
  - Cara report vuln: email / GitHub private advisory (bukan issue publik).
  - SLA respons (opsional).

- [ ] **`CODEOWNERS`** — auto-review assignment.
  - Contoh:
    ```
    *           @CivilHQ
    /tools-cli/src/fex/   @CivilHQ
    /docs/rules/          @CivilHQ
    ```
  - Pastikan username org valid di GitHub.

- [ ] **`SUPPORT.md`** (opsional) — channel bantuan (Discord, diskusi, dll).

### 2. Issue & PR Templates

- [ ] **`.github/ISSUE_TEMPLATE/bug_report.md`**
  - Frontmatter: `name`, `about`, `title`, `labels: bug`, `assignees`.
  - Body: environment, steps to reproduce, expected vs actual, logs.

- [ ] **`.github/ISSUE_TEMPLATE/feature_request.md`**
  - Frontmatter: `labels: enhancement`.
  - Body: problem, solusi usulan, alternatif, konteks.

- [ ] **`.github/ISSUE_TEMPLATE/refactor.md`**
  - Untuk tech-debt (mirip issue #1/#2/#3 yang sudah dibuat via CLI).
  - Body: lokasi file, alasan (rule coding-style), target.

- [ ] **`.github/PULL_REQUEST_TEMPLATE.md`**
  - Checklist: linter hijau, test hijau, changelog diupdate, docs sync.
  - Link ke issue terkait (`Closes #N`).

### 3. Build / Task Automation

- [ ] **`Makefile`** (atau `justfile`) — wrapper command:
  ```make
  check:     bash scripts/check_syntax.sh
  doctor:    bash scripts/doctor.sh
  build:     cd tools-cli/src/fex && go build -o dist/fex ./cmd/fe
  hooks:     bash scripts/install-hooks.sh
  install:   bash scripts/install.sh
  ```
  - Catatan: `.editorconfig` sudah punya `[Makefile]` indent tab.

- [ ] **`justfile`** (alternatif/modern) — kalau mau hindari Make dependency.

### 4. CI Enhancement (Opsional)

- [ ] **`dependabot.yml`** — auto-update dependency.
  - `package-ecosystem: gitsubmodule | npm | github-actions`, `directory: /`, `schedule: weekly`.

- [ ] **`stale.yml`** — auto-stale issue/PR (community hygiene), 60–90 hari.

- [ ] **`release.yml`** — tag-based release (build artifact `fex` binary per OS).

- [ ] **`golangci-lint`** di CI (selain `go vet`) — butuh config `golangci.yml`.

### 5. Tech-Debt Terkait (dari coding-style rule #2/#1)

- [ ] **Go module path rename**: `civil/goblin-vault/tools-cli/src/fex`
  → `github.com/CivilHQ/goblin-vault/tools-cli/src/fex`.
  - Butuh ubah semua import di `cmd/fe/` & `internal/`.
  - Risk: `go build` lokal jalan, tapi module proxy gagal kalau path gak valid.
  - Lihat issue review: item #1 (MEDIUM).

- [ ] **Refactor `fex/cmd/root.go`** (989 baris) → `cmd/modes/*.go` (issue #1).
- [ ] **Refactor `fex/internal/tree/tree.go`** (393 baris) (issue #2).
- [ ] **Fix mutasi `splice` di `ocm/utils.js`** (immutability, issue #3).

---

## Urutan Rekomendasi (Prioritas)

1. `CONTRIBUTING.md` + `CODEOWNERS` — paling berdampak buat kontributor eksternal.
2. Issue/PR templates — standarisasi input komunitas.
3. `Makefile` — DX lokal lebih enak.
4. `SECURITY.md` — wajib kalau repo public-facing.
5. CI enhancement (dependabot/stale/release) — nice-to-have.
6. Tech-debt refactor — paralel, bisa per-issue.

---

## Catatan Blin (Goblin Honesty)

- Full foundation ini **bukan blocker** — core sudah cukup buat repo bisa dipakai
  & diawasi secara otomatis. Sisa item mostly **DX & community polish**.
- Jangan lombok semua sekaligus; tiap file kecil, bisa di-commit terpisah biar
  review gampang.
- `CODEOWNERS` & template harus pakai username org yang bener (`CivilHQ`?) —
  verifikasi dulu sebelum commit.
