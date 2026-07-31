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
> | `gh-blin` — GitHub Assistant TUI | [`docs/CHANGELOG/gh-blin.md`](docs/CHANGELOG/gh-blin.md) |

---

## [Unreleased]

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

- Foundation: konfigurasi OpenCode, agents/commands/plugins, skills, `fe` v1.0, `gh-blin`, `gh_tui`, `goblin-control`, `ocm`, utility scripts. → [detail](docs/CHANGELOG/fex.md) · [detail](docs/CHANGELOG/gh-blin.md) · [detail](docs/CHANGELOG/ocm.md)

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
