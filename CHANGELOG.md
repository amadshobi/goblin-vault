# Changelog

> **Master Macro Changelog** — navigasi & ringkasan tingkat tinggi seluruh Goblin Vault.
> Detail riwayat per-tool tersedia di changelog modular masing-masing:
>
> | Tool | Changelog |
> |------|-----------|
> | `sup` — Smart Universal Package Updater | [`docs/CHANGELOG/sup.md`](docs/CHANGELOG/sup.md) |
> | `fex` — File Explorer (Go) | [`docs/CHANGELOG/fex.md`](docs/CHANGELOG/fex.md) |
> | `gn` — Goblin Nexus CLI | [`docs/CHANGELOG/gn.md`](docs/CHANGELOG/gn.md) |
> | `ocm` — OpenCode Configurator TUI | [`docs/CHANGELOG/ocm.md`](docs/CHANGELOG/ocm.md) |
> | `zf` — ZF Navigation Engine | [`docs/CHANGELOG/zf.md`](docs/CHANGELOG/zf.md) |
> | `gb` — GitHub Assistant TUI | [`docs/CHANGELOG/gb.md`](docs/CHANGELOG/gb.md) |

---

## [Unreleased]

- **`gn` v2.0.0 Refactor**: Storage cache terpusat di `~/.config/gn/cache/` dengan auto-migration, dual-mode execution (`gn ping` & `gn bench` cache instant ~5ms vs `--force` live hit), upgrade total icons CLI ke Nerd Font (`󰄬`, `󰅚`, `󰀦`, `󰓅`, `󰒓`, `󱈸`, `󱎫`, `󰋼`, `󰑐`, `󰈙`, `󰓹`, `󰋽`, `󰚌`, `󰘚`), layout `gn usage` 1-line padat dengan thin-line progress bar (`━━━━────────`), Daily Tokens & Subagent Activity Tree (`gn u -t`), File Modification Audit Mode (`gn u -f`), Compact Table mode (`gn u -t -m`), Session Explorer (`gn s list`), Dual-Level Help Standard, dan fuzzy Levenshtein error matcher (`utils/error.ts`). → [detail](docs/CHANGELOG/gn.md)
- **`gn ping` Live Probe Reliability**: Perbaikan mode `gn p <provider> --force` dengan Clack spinner per-model tanpa label berisik, payload probe valid (`Reply with only: ok`, `max_tokens: 50`), timeout default 10 detik, dan preservasi tampilan cache boxed table. → [detail](docs/CHANGELOG/gn.md)
- **`check_syntax.js` & `doctor.js` JS Engine Migration**: Migrasi total script validator repositori dari Bash kuno (`check_syntax.sh` & `doctor.sh`) ke Node.js / Bun Engine yang jauh lebih cepat, paralel, dan kaya fitur.
- **Multi-Language & Executable Permission Check**: Penambahan audit ijin eksekusi (`+x`) pada semua binary & scripts, rincian per-file `.go`, `.js`, `.ts`, dan `.sh`, serta parser error presisi (`file:line:col`) dengan format Arrow Identifier (`↳`) dan Goblin Roast Summary (`🤨 NIH BOSS FILE YANG ERROR:`).
- **Flexible CLI Flags**: Dukungan flag `--staged` (`-s`), `--working` (`-w`, mengecek modified & untracked files), dan `--full` (`-f`).
### Removed
- **Legacy Bash Wrappers**: Penghapusan total file wrapper `scripts/check_syntax.sh` dan `scripts/doctor.sh`.

---

## [v0.3.32] - 2026-08-06

### Added
- **`gb` v2.1.3 (FinOps Cost Logger, Hybrid Prompt Engine, PAGER Hardening, & Ultra-Clean TUI Streamer)**: Integrasi FinOps Token & Cost Analytics Logger (`~/.config/gb/logs/` & `price.json`), Modular Hybrid Prompt System (`src/prompts/*.md` + `~/.config/gb/prompts/`), Clean Model/Variant Manager (`models.json`), Deep Issue Technical Analysis (`gb issue analyze <num>`), PAGER RCE hardening via `spawnSync` & allowlist, temporary file system prompt isolation, READ-ONLY PR review tools (`read,glob,grep`), serta TUI streamer layout & Dual-Level Help update. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.31] - 2026-08-06

### Changed
- **`gb` v2.1.2 (Pure OMP Single-Engine Architecture)**: Simplifikasi LLM engine 100% berbasis OMP CLI (`omp --mode=json --no-session`), menghapus fallback `opencode` & `curl`, dan menjamin zero-session-trash di disk. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.30] - 2026-08-06

### Changed
- **`gb` v2.1.1 (NDJSON LLM Streaming Engine & OMP Auto-Selection)**: Mengubah `streamLLM` di `gb` agar otomatis menggunakan backend `omp` dengan flag `--mode=json` & `--print-thoughts`, menghadirkan streaming token-by-token dan visualisasi thinking real-time serealistis `sub`. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.29] - 2026-08-06
### Changed
- **`gb` v2.1.0 (Full TypeScript Migration, Sub Engine Adoption, & Issue Suite)**: Porting 100% codebase `gb` ke TypeScript modular, adopsi Live Streaming LLM Engine dari `sub`, penambahan `gb issue summarize` & `gb issue analyze`, serta pembersihan total (purge) file JS legacy. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.28] - 2026-08-06

### Added
- **`gb` v2.0.0 (Refactoring Rename `gh-blin` → `gb`)**: Rename menyeluruh tool `gh-blin` menjadi `gb` — binary, source code, changelog, dokumentasi, scripts, CI/CD, dan issue templates. → [detail](docs/CHANGELOG/gb.md)
- **`gb` v0.1.0 (GitHub Profile Management Subcommand `gb profile`)**: Menambahkan subcommand `profile` untuk melihat profil GitHub dalam format ANSI Box Card serta mengedit Bio, Name, Company, Location, & Blog secara interaktif maupun via CLI Flags (`--bio`, `--name`, dll). Terintegrasi dengan Dual-Level Help system. (Issue #12) → [detail](docs/CHANGELOG/gb.md)

## [v0.3.27] - 2026-08-06

### Fixed
- **`ocm` v0.3.16 (Immutability Refactor & Splice Elimination)**: Menghapus semua mutasi in-place `Array.prototype.splice` di `tools-cli/src/ocm/src/utils/utils.ts` dan `commands/reference.ts`. Logika insert dan delete model kini 100% immutable (Issue #3). → [detail](docs/CHANGELOG/ocm.md)

## [v0.3.26] - 2026-08-05

### Added
- **`gn` Standalone v1.0.0 TypeScript Engine Port**: Port total core `gn` dari Shell Script ke TypeScript modular (`tools-cli/src/gn/src/`) dengan pure terminal formatter (`utils/formatter.ts`) dan tabel TUI ANSI-aware alignment fix (`visibleWidth`). → [detail](docs/CHANGELOG/gn.md)

### Removed
- **`gn` Legacy Script & Dead-code Purge**: Pembersihan sisa script legacy (`quarantine.sh`, `bench.ts`, `doctor.sh`, `price.ts`, dll) dan penyelarasan router `gn.sh` & `help-formatter.sh`. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.25] - 2026-08-03

### Removed
- **`gn` Pembersihan Bom Waktu & Redundansi**: Penghapusan 6 file bermasalah dari `tools-cli/src/gn/`:
  - `quarantine.sh` (575 LoC) & inline `gn export` SQL block di `gn.sh` — manipulasi langsung `auth_credentials` SQLite + dump API key plaintext.
  - `config.ts` (~270 LoC) — JSONC parser manual berbasis regex yang rapuh.
  - `bench.ts` (487 LoC), `pool-manager.ts` (385 LoC), `agent.sh` (128 LoC), `picker.sh` (75 LoC) — redundan dengan REST API OMP.
  - Helper dead-code `_run_bench_action` di `gn.sh`, serta section "Credential Health" SQL query di `doctor.sh`.
- **Deprecation Guard** di `gn.sh` untuk handler `ping|p`, `bench|b`, `quarantine|q`, `export|e` — sekarang hanya tampilkan warning + hint REST API OMP / CLI `omp` / `ocm`. Level 1 help & Level 2 help untuk keempat command dihapus/di-update. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.24] - 2026-08-02

### Added
- **`gb` v1.1.1 (Magic `omp` Runner, `@file` Stdin Pipe, & 5 Reasoning Effort Variants)**: Integrasi backend `omp` (`--no-session`) via 3 huruf sakti `omp` di CLI, dukungan 5 reasoning effort variants (`high`, `medium`, `low`, `auto`, `none`), handling prompt `@file` untuk menghapus `E2BIG` limit, serta nested backend model mapping (`utils/models.json`). → [detail](docs/CHANGELOG/gb.md)
- **`gn` Custom Provider Sync & Network Fallback**: `gn export` mendukung ekspor provider custom dari `models.yml` (seperti `peezy`), dan `gn ping`/`gn bench` mendukung auto-discovery provider custom + IPv4 connection fallback. → [detail](docs/CHANGELOG/gn.md)
- **Changelog Guardrail Per-Tool (`scripts/check_syntax.sh`)**: Sistem pre-commit checker otomatis yang memperingatkan jika ada perubahan source code tool di `tools-cli/src/` tetapi belum ng-stage changelog per-tool (`docs/CHANGELOG/<tool>.md`) atau master `CHANGELOG.md`. → [detail](docs/CHANGELOG/gb.md)

### Fixed
- **`gb` Flag Collision & Quality Patches**: Pemisahan flag `--auto` (batch) dari variant `auto` (`--eff-auto`), preservasi error context `callOmp`, caching `hasCmd` subprocess, warning precedence `--model` vs `--variant`, penanganan prompt besar via stdin pipe, dan visual box truncation footer terminal. → [detail](docs/CHANGELOG/gb.md)
- **Automated Release Engine (`scripts/release.sh`)**: Perbaikan skrip rilis otomatis agar men-substitusi header `## [v0.3.25] - 2026-08-05` paling atas di `CHANGELOG.md`, memicu `--full` syntax check saat rilis vault, dan menggunakan guarded syntax `[[ "${TARGET:-}" == ... ]]`. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.22] - 2026-08-02

- **`gb` Automated AI PR Review Subsystem & Security Hardening**: Patch rilis awal untuk integrasi sub-system review, `spawnSync` array argv injection proofing, dan atomic review logging. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.21] - 2026-08-01

- **`gb` Automated AI PR Review Subsystem (v1.1.0)**: Peluncuran subcommand `gb pr review <number>` & batch scheduled `--auto` / `--all`, penayangan review terminal box, dan dukungan `--publish` komentar resmi GitHub PR. → [detail](docs/CHANGELOG/gb.md)
- **Model Variant Presets (`high`, `medium`, `low`)**: Dukungan preset AI review (Default active variant: **`high`** — `claude-3-5-sonnet`), variant `medium` (`gemini-3.5-flash`), variant `low` (`gemini-2.5-flash`), serta short flags CLI (`--high`, `--medium`, `--low`, `--variant <name>`, dan `--model <name>`). → [detail](docs/CHANGELOG/gb.md)
- **Config Subsystem (`gb config`)**: Subcommand configurator permanen `gb config set/get/list` untuk mengatur active variant & custom model per variant. → [detail](docs/CHANGELOG/gb.md)
- **Token Usage Logging**: Pencatatan metadata model, variant, backend, dan perincian token (`prompt`, `completion`, `total`) secara atomik di `~/.config/goblin-vault/gb-reviews.json` & footer ANSI-aware terminal. → [detail](docs/CHANGELOG/gb.md)
- **Shell-Injection Security Hardening**: Refactor total `ghExec`, `ghRaw`, dan `ghApi` dari `execSync` string concatenation ke `spawnSync` array argv verbatim di seluruh 44+ call-site. → [detail](docs/CHANGELOG/gb.md)
- **Dual-Level Help System & Practical Examples**: Penambahan section `Examples:` praktis pada `gb --help` dan `gb config --help`. → [detail](docs/CHANGELOG/gb.md)

## [v0.3.20] - 2026-08-01

- **UI & Documentation Polish**: Responsive SVG Neon Cyberpunk Banner (`docs/assets/banner.svg`), Vibrant Cyberpunk Neon Badges (`for-the-badge` style dengan `labelColor=0D1117`) di root README & 6 sub-README, folder media assets (`docs/assets/gif/` & `docs/assets/screenshoot/`), dan standalone per-tool READMEs dengan ASCII block headers. → [detail](docs/CHANGELOG/sup.md) · [detail](docs/CHANGELOG/fex.md) · [detail](docs/CHANGELOG/gn.md) · [detail](docs/CHANGELOG/ocm.md) · [detail](docs/CHANGELOG/zf.md) · [detail](docs/CHANGELOG/gb.md)
- **Open-Source Hygiene Suite**: Penambahan panduan kontribusi (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` v2.1, `SECURITY.md`, `CODEOWNERS`), form Issue GitHub Interaktif (bug report, feature request, config), Pull Request template terstandarisasi, dan konfigurasi Branch Protection Rules untuk `main`.
- **Housekeeping & Maintenance**: Konsolidasi riwayat historis `fex` ke `docs/CHANGELOG/fex.md` (membersihkan duplicate file lama di source tree) dan perbaikan Git tracking untuk meng-untrack file config local `opencode.jsonc`. → [detail](docs/CHANGELOG/fex.md)

## [v0.3.19] - 2026-07-30

### Added
- **`sup` v1.1.0 Feature Release**: granular package picker UI (default ALL selected), verbose streaming mode (`-v`), dynamic version auto-detect, precision scanner filters. → [detail](docs/CHANGELOG/sup.md)
- **`sup` TypeScript Migration**: `sup` diporting dari bash (`scripts/shell/sup.sh`) ke TypeScript modern (`tools-cli/src/sup/`) dengan Clack TUI + Dual-Level Help. → [detail](docs/CHANGELOG/sup.md)
- **`gn usage` engine**: modul unified quota live + token burn real (menggantikan `status-formatter.ts` & `burn.ts`). → [detail](docs/CHANGELOG/gn.md)
- **Goblin Shield telemetry logger** + **systemd user service** (`gn-shield.service`) + subcommand `gn shield service`. → [detail](docs/CHANGELOG/gn.md)

### Fixed
- **`sup` v1.0.1**: sudo loop fix pada `sup all`, `omp` update flag fix, UI/UX polish. → [detail](docs/CHANGELOG/sup.md)

### Changed
- `gn usage / u` routing delegasi ke `usage.ts`; `gn bench` tanpa role specialization. → [detail](docs/CHANGELOG/gn.md)

### Removed
- `burn.ts` & `status-formatter.ts` (digantikan `usage.ts`); matematika `assumedTotal 100k`; `scripts/shell/sup.sh` (diarsipkan ke `docs/history/sup-migration/`). → [detail](docs/CHANGELOG/gn.md) · [detail](docs/CHANGELOG/sup.md)

## [v0.3.15] - 2026-07-28

- Global Ultra-Clean ASCII Art Banners untuk suite CLI (GN, ZF, FEX, OCM) — banner seragam, nama tool + versi di bawah banner, pure white, margin atas lega. → [detail](docs/CHANGELOG/gn.md) · [detail](docs/CHANGELOG/zf.md) · [detail](docs/CHANGELOG/fex.md) · [detail](docs/CHANGELOG/ocm.md)

## [v0.3.14] - 2026-07-28

- `ocm` full TypeScript migration + workspace auto-discovery engine; dashboard integrator TUI; fix registry subcommand `ocm manage`. → [detail](docs/CHANGELOG/ocm.md)

## [v0.3.13] - 2026-07-27

- `gn`: Ollama Cloud real-time scraper & metadata fetcher + refactor immutability & identity-based lookup. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.11] - 2026-07-27

- `gn` Dual-Level Help System untuk seluruh subcommand. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.10] - 2026-07-27

- `scripts/check_syntax.sh`: TypeScript/AST support + fast staged mode (`--staged`) untuk pre-commit.

## [v0.3.9] - 2026-07-27

- `gn bench` dynamic multi-role benchmark engine + `gn ping` visual UX upgrade. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.8] - 2026-07-27

- `gn burn` (token & cost burn tracker) + `gn status` upgrade (visual status dot, capacity summary). → [detail](docs/CHANGELOG/gn.md)

## [v0.3.5] - 2026-07-26

- `shield-interceptor.ts` smart fallback array chain + header debug `X-Goblin-Shield-Fallback`; fast staged linter; dokumentasi prosedur release. → [detail](docs/CHANGELOG/gn.md)

## [v0.3.0] - 2026-07-26

- `scripts/release.sh` — Modular SemVer release engine (vault & per-tool).
- Port `gn`, `zf`, `shield` dari `~/.shell/` ke `tools-cli/`; `gn pool`, visual engine. → [detail](docs/CHANGELOG/gn.md) · [detail](docs/CHANGELOG/zf.md)
- `fex` refactor: pecah `cmd/root.go` & `tree.go`, rename binary `fe` → `fex`, entrypoint `cmd/fex`, fix rename/tmux/keybinding. → [detail](docs/CHANGELOG/fex.md)
- `scripts/shell/ins.sh` & `scripts/shell/sup.sh`; OSS foundation (LICENSE, hooks, CI, coding-style, AGENTS, README overhaul). → [detail](docs/CHANGELOG/sup.md)

## [0.1.0] - 2026-07-08

- `fex` rewrite dari shell `fe` ke Go CLI `fex` (v4.0) + berbagai fix tree mode. → [detail](docs/CHANGELOG/fex.md)

## [0.0.2] - 2026-07-07

- `worktree.sh` (Git Worktree Manager), `notes` tool, scaffolding `tools-cli/` + check_syntax/doctor/install scripts; `fe` refactor modular (v3.0). → [detail](docs/CHANGELOG/fex.md)

## [0.0.1] - 2026-07-06

- Foundation: konfigurasi OpenCode, agents/commands/plugins, skills, `fe` v1.0, `gb`, `gh_tui`, `goblin-control`, `ocm`, utility scripts. → [detail](docs/CHANGELOG/fex.md) · [detail](docs/CHANGELOG/gb.md) · [detail](docs/CHANGELOG/ocm.md)

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/) conventions:
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for bug fixes
- **Security** for vulnerability fixes

Riwayat detail per-tool dipecah ke `docs/CHANGELOG/<tool>.md`; file ini hanya
memuat poin makro tingkat tinggi dan navigasi.
