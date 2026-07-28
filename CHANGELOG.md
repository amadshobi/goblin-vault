# Changelog

## [v0.3.14] - 2026-07-28

### Refactored
- **`ocm` Full TypeScript Migration & Environment Auto-Discovery Engine**:
  - Konversi 100% modul `ocm` dari JavaScript CJS (`.js`) menjadi ESM TypeScript terstruktur (`.ts`) di bawah `tools-cli/src/ocm/src/`.
  - Penambahan `tsconfig.json` & definisi tipe data (`config.ts`, `models.ts`) untuk type safety penuh.
  - Fitur **Workspace Auto-Discovery**: Scanner dinamis mendukung variabel lingkungan `OPENCODE_CONFIG_DIR`, auto-detect `~/.config/opencode`, `~/.opencode`, CWD, dan sub-proyek.
  - **MCP Protocol Sync**: Mengubah toggle MCP server agar membaca & menulis field standar `enabled: true/false`.
  - **Compaction Keep Fix**: Penyelarasan `compaction.keep` menjadi nilai desimal fraksi (`0.0` - `1.0`).
  - Centralized Agent Management via `~/.opencode/opencode.jsonc`.

### Added
- **Dashboard Integrator on `ocm` TUI (`menu.js`)**:
  - Menampilkan ringkasan status aktif sebelum prompt aksi utama (`Active Workspace`, `Config File`, `Default Agent`, `Active Model`, `Last Session`, dan status validasi `API Keys`).
  - Membantu developer melihat state sistem OpenCode secara sekilas tanpa harus masuk ke sub-menu.

### Fixed
- **CLI Subcommand `ocm manage` Registry & Help**:
  - Mendaftarkan subcommand `manage` ke `validSubcommands` di `index.js`.
  - Melengkapi Level 3 Help untuk `ocm manage add --help`, `ocm manage edit --help`, dan `ocm manage delete --help`.

## [v0.3.13] - 2026-07-27

### Added
- **Ollama Cloud Real-time Scraper & Metadata Fetcher (`ollama-me.ts`)**:
  - Penarikan metadata akun Ollama Cloud resmi via `POST https://ollama.com/api/me` (Email, Plan, ID, Suspended Status) dengan auto-discovery dari SQLite DB `~/.omp/agent/agent.db` dan Secret Vault.
  - HTML Web Scraper untuk dashboard `https://ollama.com/settings` (ekstraksi persentase pemakaian persis 1:1 dari `session_usage_pct` & `weekly_usage_pct`).
  - Cache TTL 15 menit di `~/.cache/goblin-nexus/ollama-me-cache.json` untuk performa kilat.
  - Integration di `gn status`: Render diagram bar visual 28-karakter presisi 1-desimal per-akun Ollama Cloud.
  - Integration di `gn burn`: Menampilkan baris `Weekly Usage` & `Session Usage` lengkap dengan estimasi token (`17.00k tokens`) dan cost ($).

### Refactored
- **Code Review & Maintenance Improvements (`gn`)**:
  - Direct object mutation pada cumulative logic `burn.ts` diganti dengan Strict Immutability Map Update (`merged.set(key, { ... })`).
  - Positional array index matching untuk Ollama Cloud diubah menjadi Identity-based lookup (`metaByEmail` / `metaById`).
  - Komentar prioritas merge `burn.ts` disesuaikan dengan kode (`snapshot > history > broker`).
  - Error context logging ditambahkan pada scraper `ollama-me.ts`.

## [v0.3.11] - 2026-07-27

### Added
- **`gn` Dual-Level Help System**:
  - Subcommand Deep Help Manual (`help-formatter.sh`) untuk `ping`, `bench`, `status`, `burn`, `pool`, `shield`, `agent`.
  - Konsistensi akses help via `gn <command> --help`, `gn <command> -h`, atau `gn help <command>`.
  - Tampilan help estetik dengan visual header, deskripsi target, detail flag, dan contoh penggunaan praktis.

## [v0.3.10] - 2026-07-27

### Added
- **`scripts/check_syntax.sh` TypeScript Support & Fast Staged Fix**:
  - Menambahkan pengecekan sintaksis & AST TypeScript (`.ts`/`.tsx`) via Bun (`bun build --no-save`).
  - Memperbaiki mode `--staged`: Hanya memproses file yang sedang di-stage (`git diff --cached`), menghilangkan noise/scan file non-staged di pre-commit hook.
  - Updating `pre-push` hook untuk menjalankan full syntax check (Bash, Go, JS, TS) secara menyeluruh sebelum push.

## [v0.3.9] - 2026-07-27

### Added
- **`gn bench` Dynamic Multi-Role Benchmark Engine**:
  - Modular System Prompt Roles (`coder`, `bugfix`, `planning`, `codereview`) tersimpan di `tools-cli/src/gn/prompts/roles/*.txt`.
  - Modular Dataset Test Cases tersimpan di `tools-cli/src/gn/prompts/datasets/*.json`.
  - **Dual-Source of Truth Scoring**: Hybrid Scoring Matcher (Keyword & Structural Rubric) + Self-Cleaning `tools-cli/src/gn/storage/output.md` untuk Agent Deep Analytics.
  - Storage Append-Only di `tools-cli/src/gn/storage/history.json` (auto-ignored oleh Git).
  - Mode Selector: `--provider <id>`, `--vs` / `--vs=m1,m2` (Adu Banteng cross-provider), `--role <role>`, dan `--timeout <sec>` (default 60s untuk bench, 10s untuk ping).
- **`gn ping` Visual UX Upgrade**: Clean status badges (`200 OK`, `429 LIMIT`), dynamic spinner, visual ANSI latency bar (`miniBar`), dan summary lineup.

### Changed
- `gn status` & `gn burn` layout formatting cleanups (penataan visual progress bar 28-char & pembersihan secret/opaque IDs).

## [v0.3.8] - 2026-07-27

### Added
- `gn burn` (`burn.ts` + `bu` alias) — Token & Cost Burn Tracker. Mengakses REST endpoint OMP Broker v17.1.4 (`GET /v1/usage/clients` & `GET /v1/usage/history`) untuk menampilkan token burn per client dengan breakdown input/output/cache tokens, estimated cost (USD), dan sparkline history (▁▂▃▄▅▆▇█). Mendukung flag `--history`, `--json`, `--days <int>`, `--provider <id>`. Degradasi elegan ke `omp usage --json` saat broker belum menyediakan field token burn, dengan pesan Goblin Roast yang ramah.
- `gn status` upgrade (`status-formatter.ts`) — Konsumsi JSON output `omp usage --json` lalu render dengan visual status dot (`●`/`○`/`✗`) berwarna ANSI, normalisasi `usedFraction`/`windowLabel` dari shape OMP v17.1.4, ringkasan `disabledCredentials` (mis. `✗ email — disabled 3d ago: re-login to restore`), dan `capacity` summary per-provider (mis. `capacity: 7d → 2.00/2 accounts used (0.00× quota left)`). Integrasi `gum style` opsional, fallback ANSI untuk TTY/non-TTY.
- `show_help` gn — Tambah subcommand `burn`/`bu` dengan deskripsi flag & contoh penggunaan di section `EXAMPLES`.

## [v0.3.5] - 2026-07-26

### Added
- `shield-interceptor.ts` Smart Fallback Array Chain — Dukungan `fallback_models` berbasis array candidates (`Primary -> Array[Fallback1, Fallback2]`) dengan multi-level sequential retry saat upstream mengembalikan status HTTP `410`, `429`, atau `5xx`.
- Header Debug `X-Goblin-Shield-Fallback` — Menampilkan metadata jejak fallback model pada response headers yang dikirimkan ke client/OpenCode.
- Fast Staged Linter — Flag `--staged` di `check_syntax.sh` untuk hanya memeriksa staged files dan optimasi `pre-commit` hook agar commit berjalan super kilat.
- Dokumentasi Prosedur Release — Menambahkan panduan rilis otomatis `scripts/release.sh` ke `AGENTS.md` & `README.md`.

## [v0.3.0] - 2026-07-26

### Added
- `scripts/release.sh` — Modular SemVer release engine untuk Goblin Vault yang mendukung automated version bump, pre-release health audit, git tagging, dan per-tool release targets (`vault`, `fex`, `gn`, `zf`, `ocm`).
- `gn pool` — Dynamic Account Pool Switching (`pool-manager.ts` & `gn.sh`) untuk isolation proxy & bypass SQLite DB via `OMP_AUTH_BROKER_ACCOUNT_POOL_FILE`.
- `gn` Visual Engine Update — Header ASCII Art `GN PROXY` Unicode Shade Block, `gum style` double border, spinner loading `_gn_spin`, dan Goblin Roast Error handling.
- `tools-cli/src/gn/` & `tools-cli/bin/gn` — Goblin Nexus CLI port dari `~/.shell/` untuk benchmark, model routing, dan agent model switcher.
- `tools-cli/src/shield/` — Goblin Privacy Shield Interceptor (`Bun.serve` proxy) untuk masking regex API keys/secrets.
- `tools-cli/src/zf/` & `tools-cli/bin/zf` — Zoxide & Tmux Navigation Engine port dari `~/.shell/` yang kini bersatu di `tools-cli`.
- `scripts/shell/ins.sh` — Universal interactive package searcher & installer (APT, NPM, Bun, PIP, dll).
- `scripts/shell/sup.sh` — Smart parallel package updater dengan interactive multi-select.

### Changed
- `gn ping` & `gn bench` table output simplified — Menghapus kolom terduplikasi, hanya menampilkan Full Model ID & Latency/Speed secara ringkas.
- `~/.shell/core/aliases.sh` — Menghapus alias `gn` yang redundant agar `zsh-syntax-highlighting` secara otomatis membaca binary `tools-cli/bin/gn` di `$PATH` sebagai command valid (hijau).
- `fex`: rename entrypoint Go module dari `cmd/fe` ke `cmd/fex` untuk konsistensi penamaan binary & launcher script `tools-cli/bin/fex`.
- `docs/rules/coding-style.md` — panduan gaya kode wajib (immutability, file-size, error handling, input validation, naming, reusable utils, shell ISO, language/emoji)
- `AGENTS.md` — diekspansi dari 12 baris buzzword menjadi panduan lengkap (struktur repo, guideline engineering, coding standards, agent responsibilities, konvensi, do/don't)
- `README.md` — di-overhaul agar sync dengan struktur aktual (tambah `goblin-control`, `notes`, `configs/nvim`, `docs/skills`, `docs/rules`; perbaiki penjelasan `fex` sebagai Go binary & panduan build/PATH)
- `fex backup micro` — backup micro editor config from `~/.config/micro/` to `goblin-vault/configs/micro/`
- `fex restore micro` — restore micro editor config from `goblin-vault/configs/micro/` to `~/.config/micro/`
- `configs/micro/` — source-of-truth directory for micro editor configuration
  - `settings.json`, `bindings.json`, `init.lua`, `palettero.cfg`, `goblin-help.md`
  - `colorschemes/darcula-glass.micro`, `colorschemes/darcula-goblin.micro`
  - `plug/filemanager/filemanager.lua`, `syntax.yaml`, `repo.json`
- CHANGELOG.md — project changelog (since initial commit)
- Micro editor: `softwrap` enabled (long lines auto-wrap, no horizontal scroll)
- Micro editor: filemanager plugin now opens tree at parent directory of current file (not CWD)
- Foundation OSS: `LICENSE` (MIT), `.gitignore` hardened, `.editorconfig` untuk konsistensi formatting lintas editor
- CI + hooks: `.github/workflows/ci.yml` (lint + build otomatis di PR/commit), `.github/hooks/` (pre-commit + pre-push), `scripts/install-hooks.sh` untuk install hooks secara relatif
- `docs/history/` — direktori riwayat implementasi harian (`YYYY-MM-DD_nama.md`)

### Changed
- `refactor(fex)`: pecah `cmd/root.go` (989 baris) jadi modul domain (`tree_mode`, `bookmarks_mode`, `search_mode`, `find_mode`, `bindings`, `dialogs`, `filelist`) + extract `internal/util/escape.go` — Closes #1
- `.gitignore` diperbaiki: kritikal files (`AGENTS.md`, `kilo.jsonc`, `docs/rules/*`, `docs/skills/*`, `docs/update/*`) sekarang ter-track
- Hook hardening: pre-commit menjalankan `doctor.sh` secara blocking, pre-push menjalankan `doctor.sh` + build `fex`
- `refactor(fex)`: pecah `tree.go` (393 baris) jadi `tree_core.go` (240 baris, pure data model & filesystem helpers) + `tree_interactive.go` (157 baris, fzf-based selector) — Closes #2. Public API tetap, `go vet` & `go build` pass
- Binary rename: `fe` → `fex` — konsisten dengan nama folder `fex/` & perintah `fex`, update `.gitignore` & rebuild ke `~/.local/bin/fex`

### Fixed
- Git hooks menggunakan symlink relatif agar tetap jalan mesin berganti direktori repo
- Rename Ctrl+R di fex: rename kedua gagal (file "ngelock") — fix hapus `sess.SetLastOpened(newPath)` dari rename case (bukan navigasi), perbaiki `findEntry` fallback dari `strings.Contains` ke `strings.HasSuffix` dengan separator boundary, surface error `os.Rename` ke stderr, hapus guard `lines[idx] != ""` di parser `--expect` fzf.go, ganti `renameDialog` dari stdin prompt ke fzf popup dengan nama file otomatis terisi (pre-filled Query), hapus debugLog calls dari `tree_mode.go`
- Tmux breakage: panel kanan/terminal baru aneh pas fex jalan di tmux — hapus `SplitOnStartup` sepenuhnya, editor sekarang spawn di pane yang sama (bukan di panel kanan), hapus semua `tmux.InTmux()` conditional di `tree_mode.go`, `find_mode.go`, `bookmarks_mode.go`, `search_mode.go`
- Keybinding conflicts tmux ↔ nvim: tmux `bind -n C-n/C-k/C-w` bentrok sama nvim custom mappings — tmux `C-n` pindah ke `C-p`, tmux `C-k` pindah ke `C-d`, tmux `C-w` dihapus; nvim `C-q` pindah ke `C-x`, nvim `C-w` pindah ke `C-b`, nvim `C-d` duplicate line dihapus

## [0.1.0] - 2026-07-08

### Fixed
- `fex` tree mode: Esc/Ctrl-H now respects `$HOME` boundary — exits tree at root instead of navigating above home
- `fex` tree mode: scroll wrap via `--cycle` flag (cyclical scrolling top→bottom and vice versa)
- `fex` create file/folder dialog: replaced `--expect` + dummy-item pattern with `enter:print-query` binding + empty stdin — no more empty list exit code 1
- `fex`: after file/dir create, new file is automatically opened in editor (tmux-aware with `tmux.OpenFileInPane` fallback)
- `fex`: removed `sess.SetLastOpened` after create — prevents search input from being filled with new file name
- `fex`: diagnostic scripts no longer report false alarms

### Changed
- `fex`: complete rewrite from shell-based `fe` to Go CLI `fex` (v4.0) — modular architecture with subcommands (`tree`, `search`, `create`, `editor`, `path`, `kill`)
- `fex`: internal fzf API — added `Cycle` field and `--cycle` arg emission

### Removed
- `scripts/fe` — fully replaced by `fex` Go binary
- `scripts/fe.bak.*` — stale backup files

## [0.0.2] - 2026-07-07

### Added
- `worktree.sh` — Git Worktree Manager for parallel branch workflows
- `notes` tool — markdown-based notes manager
- `tools-cli/` directory with Go CLI scaffolding
- Syntax check script (`scripts/check_syntax.sh`)
- Doctor script (`scripts/doctor.sh`)
- Install script (`scripts/install.sh`)
- `.gitattributes` for cross-device line ending normalization

### Changed
- Project structure: migrated all scripts to `tools-cli/` with proper Go module layout
- `fe` (file explorer) — refactored to modular architecture (v3.0) with popup-based rename/delete, search popup, quoting safety, keybinding overhaul
- `fe` helper scripts: simplified `popup_input.sh`, replaced temp helper with static `fe-helper.sh`

## [0.0.1] - 2026-07-06

### Added
- OpenCode configuration (`opencode.jsonc`, `tui.jsonc`)
- `fe` — file explorer shell script (v1.0)
- Agent definitions: assistant, coder, code-review, explore, research, doctor, task-organizer
- Commands: health-check, prompt-optimizer, agent creator, command creator, hooks creator, instructions, prompts, rules, skills, code delegate, plan delegate, review delegate, rules delegate, executor
- Plugins: compaction-enhancer, doom-loop, fast-tools, pending-todos, smart-truncation
- Reference docs: boss-goblin, free-models, opencode-docs, path, repo-wishlist
- `gh-blin` — GitHub CLI wrapper
- `gh_tui` — GitHub TUI (issues, PRs, releases, repos)
- `goblin-control` — Node.js control center (check, cmd, create, delete, git, shortcuts)
- `ocm` — OpenCode Model manager wrapper
- Utility scripts: `remove_emojis.js`, `test.js`, etc.
- Skills: context7-mcp for library documentation queries
- TUI dashboard with commands for agents, doctor, MCP, models, providers, reference, run, sessions, settings

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/) conventions:
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for bug fixes
- **Security** for vulnerability fixes
